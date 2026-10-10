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

    const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file contains no records' }, { status: 400 });
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Header index lookups
    const firstNameIdx = headers.findIndex(h => h.includes('first name') || h === 'first');
    const lastNameIdx = headers.findIndex(h => h.includes('last name') || h === 'last');
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name');
    const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('position') || h.includes('role') || h.includes('occupation'));
    const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('organization'));
    const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('linkedin') || h.includes('profile'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail') || h.includes('mail'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
    const connectedOnIdx = headers.findIndex(h => h.includes('connected') || h.includes('date'));
    const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('city') || h.includes('country'));
    const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('headline') || h.includes('about') || h.includes('summary'));

    const imported: Prospect[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length === 0) continue;

      let name = '';
      if (nameIdx !== -1 && cols[nameIdx]) {
        name = cols[nameIdx];
      } else if (firstNameIdx !== -1) {
        name = `${cols[firstNameIdx] || ''} ${lastNameIdx !== -1 ? cols[lastNameIdx] || '' : ''}`.trim();
      }

      const jobTitle = titleIdx !== -1 ? cols[titleIdx] || 'Engineer' : 'Engineer';
      const company = companyIdx !== -1 ? cols[companyIdx] || 'Startup' : 'Startup';
      const linkedinUrl = urlIdx !== -1 ? cols[urlIdx] || '' : '';
      const email = emailIdx !== -1 ? cols[emailIdx]?.trim() || undefined : undefined;
      const phoneNumber = phoneIdx !== -1 ? cols[phoneIdx]?.trim() || undefined : undefined;
      const connectedOn = connectedOnIdx !== -1 ? cols[connectedOnIdx]?.trim() || undefined : undefined;
      const location = locationIdx !== -1 ? cols[locationIdx] || 'Remote India' : 'Remote India';
      const notes = notesIdx !== -1 ? cols[notesIdx] || '' : '';

      if (!name && !company) continue;

      const { classification, relationshipType, segregationGroup } = classifyProspectTitle(jobTitle, notes);

      const prospect: Prospect = {
        id: `p-csv-${Date.now()}-${i}`,
        name: name || 'Prospect',
        jobTitle,
        company,
        location,
        linkedinUrl: linkedinUrl || `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(name + ' ' + company)}`,
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
          title: jobTitle.toLowerCase().includes('engineer') ? jobTitle : 'Full Stack AI Engineer',
          company,
          location,
          remoteStatus: 'Remote India',
          description: notes || `Hiring opportunities at ${company}`,
          source: 'CSV Ingestion',
          hiringSignals: notes.toLowerCase().includes('hiring') ? ["We're hiring"] : [],
          requiredSkills: ['React', 'Next.js', 'Python', 'FastAPI', 'PostgreSQL'],
          minExperienceYears: 3
        }
      };

      prospect.score = calculateScoreAndMatching(prospect, prospect.jobOpportunity);
      const messages = generatePersonalizedDM(prospect, prospect.jobOpportunity);
      prospect.draftedMessage = messages.day0;
      prospect.followUpDay5Message = messages.day5;
      prospect.followUpDay12Message = messages.day12;

      addProspect(prospect);
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
