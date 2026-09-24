import { NextResponse } from 'next/server';
import {
  parseOutreachLog,
  checkDuplicateContact,
  appendOutreachLog,
  updateOutreachLogStatus
} from '@/lib/outreachLog';
import { updateProspectStatus } from '@/lib/storage';
import { OutreachLogEntry, OutreachStatus } from '@/types';

export async function GET() {
  try {
    const entries = parseOutreachLog();
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error('API /outreach-log GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to read outreach log' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, linkedinUrl, name, company, prospectId, role, personPosition, relationshipType, date } = body;

    // Check duplicate
    if (action === 'check') {
      const duplicateInfo = checkDuplicateContact(linkedinUrl, name, company);
      return NextResponse.json({ success: true, ...duplicateInfo });
    }

    // Append to outreach_log.txt
    if (action === 'append') {
      const entry: OutreachLogEntry = {
        date: date || new Date().toISOString().split('T')[0],
        name: name || 'Unknown',
        company: company || 'Unknown',
        role: role || 'Full Stack Engineer',
        personPosition: personPosition || 'Contact',
        relationshipType: relationshipType || 'Other',
        linkedinUrl: linkedinUrl || '',
        status: 'Contacted'
      };

      appendOutreachLog(entry);

      // Also update prospect in DB/JSON if prospectId provided
      if (prospectId) {
        updateProspectStatus(prospectId, 'Contacted');
      }

      return NextResponse.json({ success: true, message: 'Logged ✓', entry });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API /outreach-log POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process outreach log action' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { linkedinUrl, name, company, status, prospectId } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    const updated = updateOutreachLogStatus(linkedinUrl, name, company, status as OutreachStatus);

    if (prospectId) {
      updateProspectStatus(prospectId, status as OutreachStatus);
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('API /outreach-log PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update outreach log status' }, { status: 500 });
  }
}
