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

    // If request contains Authorization header, authenticate and persist for current user
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const { authenticateApiRequest } = await import('@/lib/supabaseClient');
      const auth = await authenticateApiRequest(request);
      if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
      }

      // Canonical UUID strictly from Supabase Auth (never trusting body.user_id)
      const userId = auth.user.id;
      const { insertNewConnections } = await import('@/lib/supabaseDb');
      const { rows } = await insertNewConnections(userId, [{
        user_id: userId,
        linkedin_url: linkedinUrl,
        name,
        company,
        position: jobTitle || 'Team Member',
        location: location || 'Remote',
        notes: notes || null,
        status: 'new',
        score: newProspect.score?.totalScore ?? null,
        raw_data: {
          score: newProspect.score,
          jobOpportunity: newProspect.jobOpportunity,
          classification,
          relationshipType,
          segregationGroup
        }
      }], auth.client);

      if (rows && rows.length > 0) {
        newProspect.id = rows[0].id;
      }
    }

    return NextResponse.json({ success: true, prospect: newProspect });
  } catch (error) {
    console.error('API /prospects POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create prospect' }, { status: 500 });
  }
}
