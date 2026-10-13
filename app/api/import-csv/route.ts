import { NextResponse } from 'next/server';
import { classifyProspectTitle, isStudentOrIntern, ClassificationResult } from '@/lib/classifier';
import { calculateScoreAndMatching } from '@/lib/scoring';
import { parseResumeBuffer } from '@/lib/resumeParser';
import { Prospect, ScoreExplanation } from '@/types';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Exact header names first (LinkedIn's export uses these), fuzzy fallback only if missing.
const ALIASES: Record<string, string[]> = {
  firstName: ['first name', 'first', 'firstname'],
  lastName: ['last name', 'last', 'lastname'],
  fullName: ['name', 'full name'],
  url: ['url', 'profile url', 'linkedin url', 'linkedin'],
  email: ['email address', 'email', 'e-mail'],
  phone: ['phone', 'phone number', 'mobile'],
  company: ['company', 'organization', 'employer'],
  position: ['position', 'title', 'job title', 'role'],
  location: ['location', 'city'],
  connectedOn: ['connected on'],
  notes: ['notes', 'headline', 'summary']
};

const FUZZY: Record<string, RegExp> = {
  firstName: /first/,
  lastName: /last/,
  url: /linkedin|profile/,
  email: /e-?mail/,
  phone: /phone|mobile/,
  company: /company|organi[sz]ation/,
  position: /position|title/,
  location: /location/,
  notes: /headline|summary/
};

export async function POST(request: Request) {
  const t0 = performance.now();
  try {
    const parsedReq = await readCsvFromRequest(request);
    if (parsedReq instanceof NextResponse) return parsedReq;

    const { csvContent, targetRole = 'Full Stack Engineer', senderName, extractedCandidate } = parsedReq;

    // ---- 1. Parse (single pass) ----
    const rows = parseCSV(csvContent);
    const t1 = performance.now();

    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file contains no records' }, { status: 400 });
    }

    // LinkedIn exports start with a "Notes:" preamble; find the real header row.
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const lower = rows[i].join(',').toLowerCase();
      if ((lower.includes('first name') || lower.includes('url')) &&
          (lower.includes('company') || lower.includes('position') || lower.includes('title'))) {
        headerIdx = i;
        break;
      }
    }

    const col = buildColumnMap(rows[headerIdx].map((h) => h.toLowerCase().trim()));
    const get = (cols: string[], key: string) => (col[key] >= 0 ? (cols[col[key]] || '').trim() : '');

    // ---- 2. Enrich: classify + score (no DM generation; that happens when a prospect is opened) ----
    const now = new Date().toISOString();
    const batch = Date.now().toString(36);
    const classifyCache = new Map<string, ClassificationResult>();
    const scoreCache = new Map<string, ScoreExplanation>();
    const seen = new Set<string>();

    let skippedStudents = 0;
    let skippedDuplicates = 0;
    const keyed: { p: Prospect; hasContact: number; score: number }[] = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const cols = rows[i];

      const first = get(cols, 'firstName');
      const last = get(cols, 'lastName');
      const fullName = first || last
        ? `${first} ${last === '.' || last === '-' ? '' : last}`.trim()
        : get(cols, 'fullName');

      // Skip blank/deleted connection rows
      if (!fullName || fullName.length < 2) continue;

      const jobTitle = get(cols, 'position') || 'Professional';
      const notes = get(cols, 'notes');

      // Interns, students and freshers can't hire or refer, so leave them out
      if (isStudentOrIntern(jobTitle, notes)) {
        skippedStudents++;
        continue;
      }

      const company = get(cols, 'company') || 'Self-employed';
      const rawUrl = get(cols, 'url');
      const dedupeKey = rawUrl
        ? rawUrl.toLowerCase().replace(/\/+$/, '')
        : `${fullName.toLowerCase()}|${company.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(dedupeKey);

      const linkedinUrl = rawUrl ||
        `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(fullName + ' ' + company)}`;
      const email = get(cols, 'email') || undefined;
      const phoneNumber = get(cols, 'phone') || undefined;
      const location = get(cols, 'location') || 'Remote';

      // Memoized: thousands of connections share titles like "Software Engineer"
      const classKey = `${jobTitle}|${notes}`.toLowerCase();
      let cls = classifyCache.get(classKey);
      if (!cls) {
        cls = classifyProspectTitle(jobTitle, notes);
        classifyCache.set(classKey, cls);
      }

      const hiring = /hiring/i.test(jobTitle) || /hiring/i.test(notes);

      const prospect: Prospect = {
        id: `p-${batch}-${i}`,
        name: fullName,
        jobTitle,
        company,
        location,
        linkedinUrl,
        email,
        phoneNumber,
        connectedOn: get(cols, 'connectedOn') || undefined,
        segregationGroup: cls.segregationGroup,
        notes,
        classification: cls.classification,
        relationshipType: cls.relationshipType,
        status: 'Not contacted',
        createdAt: now,
        updatedAt: now,
        jobOpportunity: {
          id: `j-${batch}-${i}`,
          title: targetRole,
          company,
          location,
          remoteStatus: 'Remote India',
          description: `${cls.segregationGroup} contact at ${company} for ${targetRole}`,
          source: 'LinkedIn CSV Import',
          hiringSignals: hiring ? ['Hiring Lead'] : [],
          requiredSkills: extractedCandidate?.skills || []
        }
      };

      // Memoized on every input the scorer actually reads
      const scoreKey = `${classKey}|${company}|${location}|${cls.classification}|${hiring}`.toLowerCase();
      let score = scoreCache.get(scoreKey);
      if (!score) {
        score = calculateScoreAndMatching(prospect, prospect.jobOpportunity);
        scoreCache.set(scoreKey, score);
      }
      prospect.score = score;

      keyed.push({ p: prospect, hasContact: email || phoneNumber ? 1 : 0, score: score.totalScore });
    }
    const t2 = performance.now();

    // ---- 3. Sort with precomputed keys: highest match score first (descending), then contactable ----
    keyed.sort((a, b) => b.score - a.score || b.hasContact - a.hasContact);
    const prospects = keyed.map((k) => k.p);
    const t3 = performance.now();

    const timingsMs = {
      parse: Math.round(t1 - t0),
      enrich: Math.round(t2 - t1),
      sort: Math.round(t3 - t2),
      total: Math.round(t3 - t0)
    };
    console.log(
      `[import-csv] ${prospects.length} prospects, ${skippedStudents} students/interns skipped, ` +
      `${skippedDuplicates} duplicates skipped, ${classifyCache.size} unique titles`,
      timingsMs
    );

    return NextResponse.json({
      success: true,
      count: prospects.length,
      skippedStudents,
      skippedDuplicates,
      prospects,
      senderName,
      extractedCandidate,
      timingsMs
    });
  } catch (error) {
    console.error('API /import-csv error:', error);
    return NextResponse.json({ success: false, error: 'Failed to parse CSV' }, { status: 500 });
  }
}

/** Accepts multipart FormData (field "file") or legacy JSON { csvContent }. */
async function readCsvFromRequest(request: Request): Promise<{
  csvContent: string;
  targetRole?: string;
  workflow?: string;
  senderName?: string;
  extractedCandidate?: {
    name: string | null;
    targetRole: string | null;
    skills: string[];
  };
} | NextResponse> {
  const tooLarge = () =>
    NextResponse.json({ success: false, error: 'CSV file is too large (max 10 MB)' }, { status: 413 });
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const targetRole = (form.get('targetRole') as string) || undefined;
    const workflow = (form.get('workflow') as string) || undefined;
    let senderName = (form.get('senderName') as string) || undefined;
    const resumeFile = form.get('resumeFile') as File | null;
    let extractedCandidate: { name: string | null; targetRole: string | null; skills: string[] } | undefined;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'A CSV file is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) return tooLarge();
    const csvContent = await file.text();

    if (resumeFile && typeof resumeFile !== 'string') {
      try {
        const arr = await resumeFile.arrayBuffer();
        const parsed = await parseResumeBuffer(Buffer.from(arr), resumeFile.name);
        extractedCandidate = {
          name: parsed.name,
          targetRole: parsed.targetRole,
          skills: parsed.skills
        };
        if (!senderName && parsed.name) {
          senderName = parsed.name;
        }
      } catch (err) {
        console.error('Failed to parse resumeFile in import-csv:', err);
      }
    }

    return { csvContent, targetRole, workflow, senderName, extractedCandidate };
  }

  const json = await request.json();
  const { csvContent, targetRole, workflow, senderName } = json || {};
  if (!csvContent || typeof csvContent !== 'string') {
    return NextResponse.json({ success: false, error: 'Valid CSV content is required' }, { status: 400 });
  }
  if (csvContent.length > MAX_FILE_BYTES) return tooLarge();
  return { csvContent, targetRole, workflow, senderName };
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    map[key] = headers.findIndex((h) => names.includes(h));
  }
  for (const [key, re] of Object.entries(FUZZY)) {
    if (map[key] === -1) map[key] = headers.findIndex((h) => re.test(h));
  }
  return map;
}

/**
 * Single-pass CSV parser. Handles quoted fields, escaped quotes ("") and
 * line breaks inside quotes, which a split('\n') approach gets wrong.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0; // strip BOM

  for (let i = start; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inQuotes) {
      if (c === 34) {
        if (text.charCodeAt(i + 1) === 34) { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += text[i];
      }
    } else if (c === 34) {
      inQuotes = true;
    } else if (c === 44) {
      row.push(field.trim());
      field = '';
    } else if (c === 10 || c === 13) {
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      row.push(field.trim());
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += text[i];
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}
