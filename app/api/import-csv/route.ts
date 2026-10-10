import { NextResponse } from 'next/server';
import { addProspect } from '@/lib/storage';
import { classifyProspectTitle } from '@/lib/classifier';
import { calculateScoreAndMatching } from '@/lib/scoring';
import { generatePersonalizedDM } from '@/lib/generator';
import { Prospect } from '@/types';

export async function POST(request: Request) {
  try {
    const { csvContent } = await request.json();

    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid CSV content is required' }, { status: 400 });
    }

    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file contains no records' }, { status: 400 });
    }

    // LinkedIn exports start with notes/preamble. Dynamically find the real header line.
    let headerLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const lower = lines[i].toLowerCase();
      if (
        (lower.includes('first name') || lower.includes('url')) &&
        (lower.includes('company') || lower.includes('position') || lower.includes('title'))
      ) {
        headerLineIdx = i;
        break;
      }
    }

    // Fallback to first line if no header match found
    if (headerLineIdx === -1) {
      headerLineIdx = 0;
    }

    // Parse header row
    const headers = parseCSVLine(lines[headerLineIdx]).map((h) => h.toLowerCase().trim());

    // Precise header index lookups
    const firstNameIdx = headers.findIndex((h) => h.includes('first name') || h === 'first');
    const lastNameIdx = headers.findIndex((h) => h.includes('last name') || h === 'last');
    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full name');
    const urlIdx = headers.findIndex((h) => h === 'url' || h.includes('url') || h.includes('linkedin') || h.includes('profile'));
    const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('e-mail') || h.includes('mail'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
    const companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('organization') || h.includes('employer'));
    const positionIdx = headers.findIndex((h) => h.includes('position') || h.includes('title') || h.includes('role') || h.includes('occupation'));
    const locationIdx = headers.findIndex((h) => h.includes('location') || h.includes('city') || h.includes('country'));
    const connectedOnIdx = headers.findIndex((h) => h.includes('connected') || h.includes('date'));
    const notesIdx = headers.findIndex((h) => h.includes('note') || h.includes('headline') || h.includes('about') || h.includes('summary'));

    const imported: Prospect[] = [];

    // Parse data rows starting after header row
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      if (cols.length === 0) continue;

      // Extract Name
      let fullName = '';
      const firstName = firstNameIdx !== -1 ? cols[firstNameIdx]?.trim() || '' : '';
      const lastName = lastNameIdx !== -1 ? cols[lastNameIdx]?.trim() || '' : '';

      if (firstName || lastName) {
        // Clean up standalone dots or symbols
        const cleanLast = lastName === '.' || lastName === '-' ? '' : lastName;
        fullName = `${firstName} ${cleanLast}`.trim();
      } else if (nameIdx !== -1 && cols[nameIdx]) {
        fullName = cols[nameIdx].trim();
      }

      // Skip empty or deleted connection rows (like ",,,,,,07 Sep 2026")
      if (!fullName || fullName === '.' || fullName === '-' || fullName.length < 2) {
        continue;
      }

      const jobTitle = positionIdx !== -1 && cols[positionIdx]?.trim() ? cols[positionIdx].trim() : 'Professional';
      const company = companyIdx !== -1 && cols[companyIdx]?.trim() ? cols[companyIdx].trim() : 'Self-employed';
      const linkedinUrl = urlIdx !== -1 && cols[urlIdx]?.trim()
        ? cols[urlIdx].trim()
        : `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(fullName + ' ' + company)}`;
      const email = emailIdx !== -1 && cols[emailIdx]?.trim() ? cols[emailIdx].trim() : undefined;
      const phoneNumber = phoneIdx !== -1 && cols[phoneIdx]?.trim() ? cols[phoneIdx].trim() : undefined;
      const connectedOn = connectedOnIdx !== -1 && cols[connectedOnIdx]?.trim() ? cols[connectedOnIdx].trim() : undefined;
      const location = locationIdx !== -1 && cols[locationIdx]?.trim() ? cols[locationIdx].trim() : 'Remote';
      const notes = notesIdx !== -1 && cols[notesIdx]?.trim() ? cols[notesIdx].trim() : '';

      const { classification, relationshipType, segregationGroup } = classifyProspectTitle(jobTitle, notes);

      const prospect: Prospect = {
        id: `p-csv-${Date.now()}-${i}`,
        name: fullName,
        jobTitle,
        company,
        location,
        linkedinUrl,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        connectedOn: connectedOn || undefined,
        segregationGroup,
        notes,
        classification,
        relationshipType,
        status: 'Not contacted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobOpportunity: {
          id: `j-csv-${i}`,
          title: jobTitle,
          company,
          location,
          remoteStatus: 'Remote India',
          description: `Connection at ${company} with title ${jobTitle}`,
          source: 'LinkedIn CSV Import',
          hiringSignals: jobTitle.toLowerCase().includes('hiring') || notes.toLowerCase().includes('hiring') ? ["Hiring Lead"] : [],
          requiredSkills: ['React', 'Next.js', 'Python', 'FastAPI', 'PostgreSQL'],
          minExperienceYears: 3
        }
      };

      prospect.score = calculateScoreAndMatching(prospect, prospect.jobOpportunity);
      const messages = generatePersonalizedDM(prospect, prospect.jobOpportunity);
      prospect.draftedMessage = messages.day0;
      prospect.followUpDay5Message = messages.day5;
      prospect.followUpDay12Message = messages.day12;

      imported.push(prospect);
    }

    // Sort: Contacts with Email/Phone come FIRST, then sorted by Match Score
    imported.sort((a, b) => {
      const aHasContact = Boolean(a.email || a.phoneNumber);
      const bHasContact = Boolean(b.email || b.phoneNumber);
      if (aHasContact && !bHasContact) return -1;
      if (!aHasContact && bHasContact) return 1;
      return (b.score?.totalScore || 0) - (a.score?.totalScore || 0);
    });

    return NextResponse.json({ success: true, count: imported.length, prospects: imported });
  } catch (error) {
    console.error('API /import-csv error:', error);
    return NextResponse.json({ success: false, error: 'Failed to parse CSV' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
