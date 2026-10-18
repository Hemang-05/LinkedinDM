import { NextResponse } from 'next/server';
import { parseResumeBuffer } from '@/lib/resumeParser';
import { runIncrementalImportPipeline } from '@/lib/importPipeline';
import {
  fetchExistingConnectionStatuses,
  getLatestImport,
  insertNewConnections,
  recordImport
} from '@/lib/supabaseDb';
import { authenticateApiRequest, isSupabaseConfigured } from '@/lib/supabaseClient';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const t0 = performance.now();
  try {
    const parsedReq = await readCsvFromRequest(request);
    if (parsedReq instanceof NextResponse) return parsedReq;

    const {
      csvContent,
      targetRole = 'Full Stack Engineer',
      senderName,
      extractedCandidate,
      archiveRequestedAt,
      archiveReceivedAt
    } = parsedReq;

    // Requirement 12: Strictly authenticate Supabase user and reject unauthenticated requests with 401
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Service Unavailable: Supabase is not configured' },
        { status: 503 }
      );
    }

    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing, invalid or expired session' },
        { status: 401 }
      );
    }

    // Canonical identity strictly from Supabase Auth UUID (never from body/params).
    // `db` is bound to this user's JWT so RLS evaluates auth.uid() = userId.
    const userId = auth.user.id;
    const db = auth.client;

    let previousBoundaryDate: string | null = null;
    const latestImport = await getLatestImport(userId, db);
    if (latestImport) {
      previousBoundaryDate = latestImport.archive_requested_at || latestImport.imported_at;
    }
    const existingStatusLookup = (urls: string[]) =>
      fetchExistingConnectionStatuses(userId, urls, db);

    // Run two-layer incremental import pipeline
    const pipelineResult = await runIncrementalImportPipeline({
      csvContent,
      targetRole,
      extractedSkills: extractedCandidate?.skills || [],
      previousBoundaryDate,
      existingStatusLookup,
      userId
    });

    // Persist new connections with user_id = authenticated user UUID
    let returnedProspects = pipelineResult.genuinelyNewProspects;
    if (pipelineResult.connectionRowsToInsert.length > 0) {
      const { rows } = await insertNewConnections(userId, pipelineResult.connectionRowsToInsert, db);
      if (rows.length > 0) {
        const { connectionRowToProspect } = await import('@/lib/supabaseDb');
        returnedProspects = rows.map(connectionRowToProspect);
      }
    }

    // Record import record private to this authenticated user
    await recordImport(userId, {
      archive_requested_at: archiveRequestedAt,
      archive_received_at: archiveReceivedAt,
      total_rows: pipelineResult.totalRows,
      candidate_rows: pipelineResult.candidateRowsCount,
      new_connections: pipelineResult.newConnectionsCount
    }, db);

    const tTotal = Math.round(performance.now() - t0);
    console.log(
      `[import-csv] User ${userId.slice(0, 8)}... completed in ${tTotal}ms. Total: ${pipelineResult.totalRows}, ` +
      `Candidates: ${pipelineResult.candidateRowsCount}, Genuinely New: ${pipelineResult.newConnectionsCount}, ` +
      `Skipped Terminal: ${pipelineResult.skippedTerminalCount}, Skipped Existing: ${pipelineResult.skippedExistingNewCount}`
    );

    return NextResponse.json({
      success: true,
      count: pipelineResult.newConnectionsCount,
      totalRows: pipelineResult.totalRows,
      candidateRows: pipelineResult.candidateRowsCount,
      skippedStudents: pipelineResult.skippedStudents,
      skippedDuplicates: pipelineResult.skippedExistingNewCount + pipelineResult.skippedTerminalCount,
      skippedTerminal: pipelineResult.skippedTerminalCount,
      prospects: returnedProspects,
      senderName,
      extractedCandidate,
      timingsMs: { total: tTotal }
    });
  } catch (error) {
    console.error('API /import-csv error:', error);
    return NextResponse.json({ success: false, error: 'Failed to parse CSV' }, { status: 500 });
  }
}

/** Accepts multipart FormData (field "file") or legacy JSON { csvContent }. */
async function readCsvFromRequest(request: Request): Promise<{
  csvContent: string;
  targetRole?: string;
  workflow?: string;
  senderName?: string;
  archiveRequestedAt?: string;
  archiveReceivedAt?: string;
  extractedCandidate?: {
    name: string | null;
    targetRole: string | null;
    skills: string[];
  };
} | NextResponse> {
  const tooLarge = () =>
    NextResponse.json({ success: false, error: 'CSV file is too large (max 10 MB)' }, { status: 413 });
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const targetRole = (form.get('targetRole') as string) || undefined;
    const workflow = (form.get('workflow') as string) || undefined;
    let senderName = (form.get('senderName') as string) || undefined;
    const archiveRequestedAt = (form.get('archiveRequestedAt') as string) || undefined;
    const archiveReceivedAt = (form.get('archiveReceivedAt') as string) || undefined;
    const resumeFile = form.get('resumeFile') as File | null;
    let extractedCandidate: { name: string | null; targetRole: string | null; skills: string[] } | undefined;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'A CSV file is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) return tooLarge();
    const csvContent = await file.text();

    if (resumeFile && typeof resumeFile !== 'string') {
      try {
        const arr = await resumeFile.arrayBuffer();
        const parsed = await parseResumeBuffer(Buffer.from(arr), resumeFile.name);
        extractedCandidate = {
          name: parsed.name,
          targetRole: parsed.targetRole,
          skills: parsed.skills
        };
        if (!senderName && parsed.name) {
          senderName = parsed.name;
        }
      } catch (err) {
        console.error('Failed to parse resumeFile in import-csv:', err);
      }
    }

    return {
      csvContent,
      targetRole,
      workflow,
      senderName,
      archiveRequestedAt,
      archiveReceivedAt,
      extractedCandidate
    };
  }

  const json = await request.json();
  const {
    csvContent,
    targetRole,
    workflow,
    senderName,
    archiveRequestedAt,
    archiveReceivedAt
  } = json || {};
  if (!csvContent || typeof csvContent !== 'string') {
    return NextResponse.json({ success: false, error: 'Valid CSV content is required' }, { status: 400 });
  }
  if (csvContent.length > MAX_FILE_BYTES) return tooLarge();
  return {
    csvContent,
    targetRole,
    workflow,
    senderName,
    archiveRequestedAt,
    archiveReceivedAt
  };
}
