import { NextResponse } from 'next/server';
import { parseResumeWithLlmOrFallback } from '@/lib/groqParser';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB limit

export async function POST(request: Request) {
  try {
    // 1. IP Rate Limiting Check (Shared Store with local-dev in-memory fallback)
    const clientIp = getClientIp(request);
    const isAllowed = await checkRateLimit(clientIp);

    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Maximum 10 resume parses per hour.'
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No resume file provided' },
        { status: 400 }
      );
    }

    // 2. Max File Size Check (2 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'File size exceeds maximum allowed limit of 2 MB'
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Parse with Groq LLM (with regex fallback)
    // Never log resume text or LLM response
    const parsed = await parseResumeWithLlmOrFallback(buffer, file.name);

    return NextResponse.json({
      success: true,
      name: parsed.name,
      targetRole: parsed.targetRole,
      skills: parsed.skills,
      primarySkills: parsed.primarySkills,
      yearsOfExperience: parsed.yearsOfExperience,
      domain: parsed.domain,
      background: parsed.background,
      bioSummary: parsed.bioSummary,
      relevantExperience: parsed.relevantExperience,
      email: parsed.email,
      phone: parsed.phone,
      preview: parsed.rawTextPreview
    });
  } catch (error: any) {
    // Sanitized logging: never log resume text or sensitive file content
    console.error('API /parse-resume execution error:', error?.message || 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Failed to parse resume file' },
      { status: 500 }
    );
  }
}
