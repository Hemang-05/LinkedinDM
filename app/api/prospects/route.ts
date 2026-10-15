import { NextResponse } from 'next/server';
import { classifyProspectTitle } from '../../../lib/classifier';
import { calculateScoreAndMatching } from '../../../lib/scoring';
import { Prospect } from '../../../types';

/**
 * /api/prospects is 100% stateless.
 * All persistence lives client-side in IndexedDB (namespace: directmessage_prospects_v1).
 * No shared file is read or written on the server.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, jobTitle, company, companyWebsite, location, linkedinUrl, notes, jobTitleOpening, jobDescription, remoteStatus } = body;

    if (!name || !company || !linkedinUrl) {
      return NextResponse.json({ success: false, error: 'Name, Company, and LinkedIn URL are required' }, { status: 400 });
    }

    const { classification, relationshipType, segregationGroup } = classifyProspectTitle(jobTitle || 'Engineer', notes || '');

    const newProspect: Prospect = {
      id: `p-${Date.now()}`,
      name,
      jobTitle: jobTitle || 'Team Member',
      company,
      companyWebsite: companyWebsite || '',
      location: location || 'Remote',
      linkedinUrl,
      notes: notes || '',
      classification,
      relationshipType,
      segregationGroup,
      status: 'Not contacted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobOpportunity: jobTitleOpening ? {
        id: `j-${Date.now()}`,
        title: jobTitleOpening,
        company,
        location: location || 'Remote',
        remoteStatus: remoteStatus || 'Remote',
        description: jobDescription || '',
        source: 'Manual Entry',
        hiringSignals: ['Direct Opportunity'],
        requiredSkills: Array.isArray(body.requiredSkills) ? body.requiredSkills : []
      } : undefined
    };

    newProspect.score = calculateScoreAndMatching(newProspect, newProspect.jobOpportunity);

    return NextResponse.json({ success: true, prospect: newProspect });
  } catch (error) {
    console.error('API /prospects POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create prospect' }, { status: 500 });
  }
}
