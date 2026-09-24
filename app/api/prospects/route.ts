import { NextResponse } from 'next/server';
import { getStoredProspects, addProspect, updateProspectStatus } from '@/lib/storage';
import { classifyProspectTitle } from '@/lib/classifier';
import { calculateScoreAndMatching } from '@/lib/scoring';
import { generatePersonalizedDM } from '@/lib/generator';
import { Prospect } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || '';
    const classification = searchParams.get('classification') || '';

    let prospects = getStoredProspects();

    if (search) {
      prospects = prospects.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.company.toLowerCase().includes(search) ||
        p.jobTitle.toLowerCase().includes(search) ||
        p.jobOpportunity?.title.toLowerCase().includes(search) ||
        p.headline?.toLowerCase().includes(search) ||
        p.score?.strongMatches.some(m => m.toLowerCase().includes(search))
      );
    }

    if (status && status !== 'All') {
      prospects = prospects.filter(p => p.status === status);
    }

    if (classification && classification !== 'All') {
      prospects = prospects.filter(p => p.classification === classification);
    }

    // Sort by match score descending
    prospects.sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));

    return NextResponse.json({ success: true, prospects });
  } catch (error) {
    console.error('API /prospects GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch prospects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, jobTitle, company, companyWebsite, location, linkedinUrl, notes, jobTitleOpening, jobDescription, remoteStatus } = body;

    if (!name || !company || !linkedinUrl) {
      return NextResponse.json({ success: false, error: 'Name, Company, and LinkedIn URL are required' }, { status: 400 });
    }

    const { classification, relationshipType } = classifyProspectTitle(jobTitle || 'Engineer', notes || '');

    const newProspect: Prospect = {
      id: `p-${Date.now()}`,
      name,
      jobTitle: jobTitle || 'Team Member',
      company,
      companyWebsite: companyWebsite || '',
      location: location || 'Remote India',
      linkedinUrl,
      notes: notes || '',
      classification,
      relationshipType,
      status: 'Not contacted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobOpportunity: jobTitleOpening ? {
        id: `j-${Date.now()}`,
        title: jobTitleOpening,
        company,
        location: location || 'Remote India',
        remoteStatus: remoteStatus || 'Remote India',
        description: jobDescription || '',
        source: 'Manual Entry',
        hiringSignals: ['Direct Opportunity'],
        requiredSkills: ['React', 'Next.js', 'Python', 'FastAPI', 'PostgreSQL']
      } : undefined
    };

    newProspect.score = calculateScoreAndMatching(newProspect, newProspect.jobOpportunity);
    const messages = generatePersonalizedDM(newProspect, newProspect.jobOpportunity);
    newProspect.draftedMessage = messages.day0;
    newProspect.followUpDay5Message = messages.day5;
    newProspect.followUpDay12Message = messages.day12;

    const saved = addProspect(newProspect);
    return NextResponse.json({ success: true, prospect: saved });
  } catch (error) {
    console.error('API /prospects POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create prospect' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, message } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID and Status are required' }, { status: 400 });
    }

    const updated = updateProspectStatus(id, status, message);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, prospect: updated });
  } catch (error) {
    console.error('API /prospects PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update prospect' }, { status: 500 });
  }
}
