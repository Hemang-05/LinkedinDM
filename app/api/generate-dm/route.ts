import { NextResponse } from 'next/server';
import { generatePersonalizedDM, MessageAngle } from '@/lib/generator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prospect, job, targetRole, angle = 'standard', userProfile, outreachGoal, overridePersona } = body;

    if (!prospect) {
      return NextResponse.json({ success: false, error: 'Prospect data is required' }, { status: 400 });
    }
    if (!userProfile) {
      return NextResponse.json({ success: false, error: 'User profile is required to generate messages' }, { status: 400 });
    }

    const effectiveRole = targetRole || (job && typeof job === 'object' ? job.title : job);
    const messages = generatePersonalizedDM(
      prospect,
      effectiveRole,
      angle as MessageAngle,
      userProfile,
      outreachGoal,
      overridePersona
    );

    return NextResponse.json({
      success: true,
      day0: messages.day0,
      day5: messages.day5,
      day12: messages.day12,
      validation: messages.validation
    });
  } catch (error: any) {
    console.error('API /generate-dm error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to generate message' }, { status: 500 });
  }
}
