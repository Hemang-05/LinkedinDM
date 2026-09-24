import { NextResponse } from 'next/server';
import { generatePersonalizedDM } from '@/lib/generator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prospect, job, angle } = body;

    if (!prospect) {
      return NextResponse.json({ success: false, error: 'Prospect data is required' }, { status: 400 });
    }

    const messages = generatePersonalizedDM(prospect, job);

    // If an alternative angle requested
    let customDay0 = messages.day0;
    if (angle === 'founding') {
      const firstName = (prospect.name || 'there').trim().split(' ')[0];
      const company = prospect.company || 'your team';
      const role = job?.title || prospect.jobTitle || 'Founding Engineer';
      customDay0 = `Hi ${firstName}, saw you are scaling ${company} and looking for a ${role}.

I have 3+ years building production web apps and AI pipelines with React/Next.js, TypeScript, Python/FastAPI, and PostgreSQL. I thrive with high autonomy and direct ownership in early-stage environments.

Would love to learn more about the team's roadmap and see if my background could help accelerate things.

Best,
Hemang`;
    } else if (angle === 'ai_rag') {
      const firstName = (prospect.name || 'there').trim().split(' ')[0];
      const company = prospect.company || 'your team';
      const role = job?.title || prospect.jobTitle || 'Full Stack AI Engineer';
      customDay0 = `Hi ${firstName}, came across the ${role} opening at ${company}.

I'm a Full Stack / AI Engineer (3+ yrs) specializing in modern Next.js/React frontends, FastAPI backends, PostgreSQL, and production LLM/RAG workflows. I build fast, clean architectures from database schema to UI.

Would welcome the chance to connect and see if my technical background could support what you're building at ${company}.

Best,
Hemang`;
    }

    return NextResponse.json({
      success: true,
      day0: customDay0,
      day5: messages.day5,
      day12: messages.day12
    });
  } catch (error) {
    console.error('API /generate-dm error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate message' }, { status: 500 });
  }
}
