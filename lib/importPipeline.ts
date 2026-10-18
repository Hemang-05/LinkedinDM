/**
 * Incremental LinkedIn CSV Import Pipeline
 *
 * Implements the two-layer incremental import filter:
 * 1. Parse CSV
 * 2. Canonical URL normalization
 * 3. Layer 1: Temporal candidate filter (Connected On >= previous archive_requested_at boundary)
 * 4. Layer 2: Database identity filter (checks Supabase existing status; ignores contacted/skipped terminal states and existing new)
 * 5. Classify + score only genuinely new connections
 * 6. Prepares connection rows for database persistence
 */

import { normalizeLinkedInUrl } from './urlNormalizer';
import { isEligibleByTemporalFilter, parseConnectedOnDate } from './temporalFilter';
import { classifyProspectTitle, isStudentOrIntern, classifyTitle, ClassificationResult } from './classifier';
import { calculateScoreAndMatching } from './scoring';
import { Prospect, ScoreExplanation } from '@/types';
import { ConnectionRow, ConnectionStatus } from '@/types/supabase';

export interface RawCsvRow {
  index: number;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  position: string;
  rawUrl: string;
  normalizedUrl: string;
  email?: string;
  phone?: string;
  location?: string;
  connectedOn?: string;
  connectedOnIso?: string | null;
  notes?: string;
}

export interface ImportPipelineOptions {
  csvContent: string;
  targetRole?: string;
  extractedSkills?: string[];
  previousBoundaryDate?: string | Date | null;
  existingStatusLookup?: (urls: string[]) => Promise<Map<string, ConnectionStatus>>;
  userId?: string;
}

export interface ImportPipelineResult {
  totalRows: number;
  candidateRowsCount: number;
  newConnectionsCount: number;
  skippedStudents: number;
  skippedTerminalCount: number; // contacted or skipped
  skippedExistingNewCount: number; // already in DB as new
  genuinelyNewProspects: Prospect[];
  connectionRowsToInsert: Array<Partial<ConnectionRow>>;
}

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

export function parseCsvRows(text: string): string[][] {
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
 * Executes the complete incremental import pipeline
 */
export async function runIncrementalImportPipeline(
  options: ImportPipelineOptions
): Promise<ImportPipelineResult> {
  const {
    csvContent,
    targetRole = 'Full Stack Engineer',
    extractedSkills = [],
    previousBoundaryDate,
    existingStatusLookup,
    userId
  } = options;

  // 1. Parse CSV
  const rawRows = parseCsvRows(csvContent);
  if (rawRows.length < 2) {
    return {
      totalRows: 0,
      candidateRowsCount: 0,
      newConnectionsCount: 0,
      skippedStudents: 0,
      skippedTerminalCount: 0,
      skippedExistingNewCount: 0,
      genuinelyNewProspects: [],
      connectionRowsToInsert: []
    };
  }

  // Find header row (skips preamble)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const lower = rawRows[i].join(',').toLowerCase();
    if ((lower.includes('first name') || lower.includes('url')) &&
        (lower.includes('company') || lower.includes('position') || lower.includes('title'))) {
      headerIdx = i;
      break;
    }
  }

  const col = buildColumnMap(rawRows[headerIdx].map((h) => h.toLowerCase().trim()));
  const get = (cols: string[], key: string) => (col[key] >= 0 ? (cols[col[key]] || '').trim() : '');

  const parsedValidRows: RawCsvRow[] = [];
  let skippedStudents = 0;
  const inMemorySeenUrls = new Set<string>();

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const cols = rawRows[i];
    const first = get(cols, 'firstName');
    const last = get(cols, 'lastName');
    const fullName = first || last
      ? `${first} ${last === '.' || last === '-' ? '' : last}`.trim()
      : get(cols, 'fullName');

    if (!fullName || fullName.length < 2) continue;

    const jobTitle = get(cols, 'position') || 'Professional';
    const notes = get(cols, 'notes');

    if (isStudentOrIntern(jobTitle, notes)) {
      skippedStudents++;
      continue;
    }

    const company = get(cols, 'company') || 'Self-employed';
    const rawUrl = get(cols, 'url');
    const normalizedUrl = normalizeLinkedInUrl(rawUrl, fullName, company);

    // In-memory dedupe across rows in the same CSV
    if (inMemorySeenUrls.has(normalizedUrl)) {
      continue;
    }
    inMemorySeenUrls.add(normalizedUrl);

    const connectedOn = get(cols, 'connectedOn') || undefined;
    const connectedOnIso = parseConnectedOnDate(connectedOn);

    parsedValidRows.push({
      index: i,
      firstName: first,
      lastName: last,
      fullName,
      company,
      position: jobTitle,
      rawUrl,
      normalizedUrl,
      email: get(cols, 'email') || undefined,
      phone: get(cols, 'phone') || undefined,
      location: get(cols, 'location') || 'Remote',
      connectedOn,
      connectedOnIso,
      notes
    });
  }

  const totalRows = parsedValidRows.length;

  // 2. Layer 1: Temporal Candidate Filter
  // If a previous boundary exists, filter rows by Connected On >= boundary date.
  // Conservative: unparseable dates are retained.
  let candidateRows: RawCsvRow[] = [];
  if (previousBoundaryDate) {
    candidateRows = parsedValidRows.filter((r) =>
      isEligibleByTemporalFilter(r.connectedOn, previousBoundaryDate)
    );
  } else {
    candidateRows = parsedValidRows;
  }

  const candidateRowsCount = candidateRows.length;

  // 3. Layer 2: Database Identity Filter
  // Batch check candidate URLs against Supabase
  let genuinelyNewRows: RawCsvRow[] = [];
  let skippedTerminalCount = 0;
  let skippedExistingNewCount = 0;

  if (existingStatusLookup && candidateRows.length > 0) {
    const candidateUrls = candidateRows.map((r) => r.normalizedUrl);
    const statusMap = await existingStatusLookup(candidateUrls);

    for (const row of candidateRows) {
      const existingStatus = statusMap.get(row.normalizedUrl);

      // Terminal state: Contacted or Skipped -> ignore completely!
      if (existingStatus === 'contacted' || existingStatus === 'skipped') {
        skippedTerminalCount++;
        continue;
      }

      // Existing 'new' -> already in DB as new, do not recreate or duplicate
      if (existingStatus === 'new') {
        skippedExistingNewCount++;
        continue;
      }

      // Not existing in DB -> genuinely new!
      genuinelyNewRows.push(row);
    }
  } else {
    // If no DB lookup provided (e.g. unauthenticated preview), all candidates pass
    genuinelyNewRows = candidateRows;
  }

  // 4. Classify + score ONLY genuinely new connections
  const now = new Date().toISOString();
  const batch = Date.now().toString(36);
  const classifyCache = new Map<string, ClassificationResult>();
  const scoreCache = new Map<string, ScoreExplanation>();

  const genuinelyNewProspects: Prospect[] = [];
  const connectionRowsToInsert: Array<Partial<ConnectionRow>> = [];

  for (const row of genuinelyNewRows) {
    const classKey = `${row.position}|${row.notes || ''}`.toLowerCase();
    let cls = classifyCache.get(classKey);
    if (!cls) {
      cls = classifyProspectTitle(row.position, row.notes);
      classifyCache.set(classKey, cls);
    }

    const hiring = /hiring/i.test(row.position) || /hiring/i.test(row.notes || '');

    const prospect: Prospect = {
      id: `p-${batch}-${row.index}`,
      name: row.fullName,
      jobTitle: row.position,
      company: row.company,
      location: row.location || 'Remote',
      linkedinUrl: row.normalizedUrl,
      email: row.email,
      phoneNumber: row.phone,
      connectedOn: row.connectedOn,
      segregationGroup: cls.segregationGroup,
      notes: row.notes,
      classification: cls.classification,
      relationshipType: cls.relationshipType,
      category: classifyTitle(row.position),
      status: 'Not contacted',
      createdAt: now,
      updatedAt: now,
      jobOpportunity: {
        id: `j-${batch}-${row.index}`,
        title: targetRole,
        company: row.company,
        location: row.location || 'Remote',
        remoteStatus: 'Remote India',
        description: `${cls.segregationGroup} contact at ${row.company} for ${targetRole}`,
        source: 'LinkedIn CSV Import',
        hiringSignals: hiring ? ['Hiring Lead'] : [],
        requiredSkills: extractedSkills
      }
    };

    const scoreKey = `${classKey}|${row.company}|${row.location}|${cls.classification}|${hiring}`.toLowerCase();
    let score = scoreCache.get(scoreKey);
    if (!score) {
      score = calculateScoreAndMatching(prospect, prospect.jobOpportunity);
      scoreCache.set(scoreKey, score);
    }
    prospect.score = score;

    genuinelyNewProspects.push(prospect);

    if (userId) {
      connectionRowsToInsert.push({
        user_id: userId,
        linkedin_url: row.normalizedUrl,
        name: row.fullName,
        first_name: row.firstName || null,
        last_name: row.lastName || null,
        company: row.company,
        position: row.position,
        email: row.email || null,
        phone: row.phone || null,
        category: prospect.category || null,
        score: score.totalScore,
        connected_on: row.connectedOnIso || null,
        status: 'new',
        location: row.location || null,
        notes: row.notes || null,
        first_seen_at: now,
        last_seen_at: now,
        raw_data: {
          score,
          jobOpportunity: prospect.jobOpportunity,
          segregationGroup: prospect.segregationGroup,
          classification: prospect.classification,
          relationshipType: prospect.relationshipType,
          category: prospect.category
        }
      });
    }
  }

  // Sort genuinely new prospects descending by score
  genuinelyNewProspects.sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0));

  return {
    totalRows,
    candidateRowsCount,
    newConnectionsCount: genuinelyNewProspects.length,
    skippedStudents,
    skippedTerminalCount,
    skippedExistingNewCount,
    genuinelyNewProspects,
    connectionRowsToInsert
  };
}
