import { NextResponse } from 'next/server';
import { parseResumeBuffer } from '@/lib/resumeParser';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No resume file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseResumeBuffer(buffer, file.name);

    return NextResponse.json({
      success: true,
      name: parsed.name,
      targetRole: parsed.targetRole,
      skills: parsed.skills,
      yearsOfExperience: parsed.yearsOfExperience,
      email: parsed.email,
      phone: parsed.phone,
      preview: parsed.rawTextPreview
    });
  } catch (error) {
    console.error('API /parse-resume error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse resume file' },
      { status: 500 }
    );
  }
}
