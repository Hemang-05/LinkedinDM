/**
 * Supabase Database Access Layer for LinkedInDM
 *
 * Implements:
 * - Persistence for profiles, connections, outreach_events, imports
 * - Layer 2 identity filtering
 * - Strict outreach state preservation (contacted > skipped > new)
 * - Due and upcoming follow-ups queries
 * - Local storage data migration to Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { normalizeLinkedInUrl } from './urlNormalizer';
import {
  ConnectionRow,
  ConnectionStatus,
  DueFollowUp,
  ImportRow,
  OutreachEventRow,
  ProfileRow
} from '@/types/supabase';
import { Prospect, UserProfile, OutreachStatus } from '@/types';
import { EMPTY_PROFILE } from './profile';

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch user profile from Supabase
 */
export async function getSupabaseProfile(userId: string): Promise<UserProfile | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as ProfileRow;
    return {
      ...EMPTY_PROFILE,
      name: row.name || '',
      title: row.experience || '',
      targetRole: row.target_roles?.[0] || '',
      targetRoles: row.target_roles || [],
      skills: row.skills || [],
      primarySkills: (row.skills || []).slice(0, 5),
      location: row.location || '',
      workPreference: (row.work_preference as any) || 'Remote',
      bioSummary: row.experience || '',
      agencyServiceSummary: row.agency_info?.serviceSummary || '',
      agencyOffering: row.agency_info?.offering || ''
    };
  } catch (err) {
    console.error('[Supabase] Error reading profile:', err);
    return null;
  }
}

/**
 * Save user profile to Supabase
 */
export async function saveSupabaseProfile(
  userId: string,
  profile: UserProfile,
  email?: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const row: Partial<ProfileRow> = {
      id: userId,
      name: profile.name,
      email: email || null,
      experience: profile.title || profile.bioSummary,
      skills: profile.skills,
      target_roles: profile.targetRoles,
      location: profile.location || profile.preferredLocation,
      work_preference: profile.workPreference,
      agency_info: {
        serviceSummary: profile.agencyServiceSummary,
        offering: profile.agencyOffering
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('profiles').upsert(row);
    if (error) {
      console.error('[Supabase] Failed saving profile:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error saving profile:', err);
    return false;
  }
}

/**
 * Ensures a profile exists for the authenticated user (Requirement 3).
 * If profile already exists, returns it without creating a duplicate.
 * If not, creates the profiles row with id = auth.users.id.
 */
export async function ensureSupabaseProfile(
  userId: string,
  email?: string,
  initialData?: Partial<UserProfile>
): Promise<UserProfile> {
  const existing = await getSupabaseProfile(userId);
  if (existing && existing.name && existing.name.trim() !== 'Your Name') {
    const hasRole = Boolean((existing.targetRole && existing.targetRole.trim()) || (existing.title && existing.title.trim()));
    if (!hasRole || !existing.skills || existing.skills.length === 0) {
      const enriched: UserProfile = {
        ...existing,
        title: existing.title || initialData?.title || 'Full Stack Engineer',
        targetRole: existing.targetRole || initialData?.targetRole || 'Full Stack Engineer',
        targetRoles: (existing.targetRoles && existing.targetRoles.length > 0) ? existing.targetRoles : [initialData?.targetRole || 'Full Stack Engineer'],
        skills: (existing.skills && existing.skills.length > 0) ? existing.skills : (initialData?.skills || ['React', 'TypeScript', 'Node.js']),
        primarySkills: (existing.skills && existing.skills.length > 0) ? existing.skills.slice(0, 5) : ['React', 'TypeScript', 'Node.js']
      };
      await saveSupabaseProfile(userId, enriched, email);
      return enriched;
    }
    return existing;
  }

  const defaultName = initialData?.name || email?.split('@')[0] || 'User';
  const newProfile: UserProfile = {
    ...EMPTY_PROFILE,
    name: defaultName,
    title: initialData?.title || initialData?.bioSummary || 'Full Stack Engineer',
    targetRole: initialData?.targetRole || 'Full Stack Engineer',
    targetRoles: initialData?.targetRoles || [initialData?.targetRole || 'Full Stack Engineer'],
    skills: initialData?.skills || ['React', 'TypeScript', 'Node.js'],
    primarySkills: (initialData?.skills || ['React', 'TypeScript', 'Node.js']).slice(0, 5),
    location: initialData?.location || 'Remote',
    workPreference: initialData?.workPreference || 'Remote',
    bioSummary: initialData?.bioSummary || '',
    agencyServiceSummary: initialData?.agencyServiceSummary || '',
    agencyOffering: initialData?.agencyOffering || ''
  };

  await saveSupabaseProfile(userId, newProfile, email);
  return newProfile;
}

/**
 * Get latest import record for temporal boundary filtering
 */
export async function getLatestImport(
  userId: string,
  dbClient?: SupabaseClient
): Promise<ImportRow | null> {
  const client = dbClient || getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('imports')
      .select('*')
      .eq('user_id', userId)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as ImportRow;
  } catch (err) {
    console.warn('[Supabase] Error getting latest import:', err);
    return null;
  }
}

/**
 * Layer 2: Batch query existing LinkedIn URLs and their outreach status for this user
 * Does NOT query row-by-row; executes in chunks of 500 URLs.
 */
export async function fetchExistingConnectionStatuses(
  userId: string,
  candidateUrls: string[],
  dbClient?: SupabaseClient
): Promise<Map<string, ConnectionStatus>> {
  const result = new Map<string, ConnectionStatus>();
  const client = dbClient || getSupabaseClient();
  if (!client || candidateUrls.length === 0) return result;

  const uniqueUrls = Array.from(new Set(candidateUrls));
  // Use chunks of 50 URLs to prevent HTTP header overflow (HeadersOverflowError on large batches)
  const batches = chunkArray(uniqueUrls, 50);

  for (const batch of batches) {
    try {
      const { data, error } = await client
        .from('connections')
        .select('linkedin_url, status')
        .eq('user_id', userId)
        .in('linkedin_url', batch);

      if (error) {
        console.error('[Supabase] Error in Layer 2 identity check:', error);
        continue;
      }

      for (const row of data || []) {
        result.set(row.linkedin_url, row.status as ConnectionStatus);
      }
    } catch (err) {
      console.error('[Supabase] Batch query exception in identity check:', err);
    }
  }

  return result;
}

/**
 * Insert genuinely new connections into Supabase.
 * Respects unique(user_id, linkedin_url) constraint and returns inserted rows.
 */
export async function insertNewConnections(
  userId: string,
  connections: Array<Partial<ConnectionRow>>,
  dbClient?: SupabaseClient
): Promise<{ count: number; rows: ConnectionRow[] }> {
  const client = dbClient || getSupabaseClient();
  if (!client || connections.length === 0) return { count: 0, rows: [] };

  const batches = chunkArray(connections, 250);
  let totalInserted = 0;
  const insertedRows: ConnectionRow[] = [];

  for (const batch of batches) {
    try {
      // Ensure user_id is explicitly set on every connection row
      const sanitizedBatch = batch.map((row) => ({
        ...row,
        user_id: userId
      }));

      const { data, error } = await client
        .from('connections')
        .upsert(sanitizedBatch, { onConflict: 'user_id,linkedin_url', ignoreDuplicates: true })
        .select('*');

      if (error) {
        console.error('[Supabase] Error inserting connections batch:', error);
      } else if (data) {
        totalInserted += data.length;
        insertedRows.push(...(data as ConnectionRow[]));
      }
    } catch (err) {
      console.error('[Supabase] Exception inserting connections batch:', err);
    }
  }

  return { count: totalInserted, rows: insertedRows };
}

/**
 * Record an import event in the imports table
 */
export async function recordImport(
  userId: string,
  importData: {
    archive_requested_at?: string | null;
    archive_received_at?: string | null;
    total_rows: number;
    candidate_rows: number;
    new_connections: number;
  },
  dbClient?: SupabaseClient
): Promise<ImportRow | null> {
  const client = dbClient || getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      user_id: userId,
      archive_requested_at: importData.archive_requested_at || new Date().toISOString(),
      archive_received_at: importData.archive_received_at || new Date().toISOString(),
      imported_at: new Date().toISOString(),
      total_rows: importData.total_rows,
      candidate_rows: importData.candidate_rows,
      new_connections: importData.new_connections
    };

    const { data, error } = await client
      .from('imports')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error recording import:', error);
      return null;
    }
    return data as ImportRow;
  } catch (err) {
    console.error('[Supabase] Exception recording import:', err);
    return null;
  }
}

/**
 * Retrieve all connections for a user from Supabase and map to Prospect format
 */
export async function getSupabaseConnections(
  userId: string,
  filterStatus?: ConnectionStatus
): Promise<Prospect[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client
      .from('connections')
      .select('*')
      .eq('user_id', userId)
      .order('score', { ascending: false, nullsFirst: false });

    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error('[Supabase] Error fetching connections:', error);
      return [];
    }

    return (data as ConnectionRow[]).map(connectionRowToProspect);
  } catch (err) {
    console.error('[Supabase] Exception fetching connections:', err);
    return [];
  }
}

/**
 * Converts a database ConnectionRow to a frontend Prospect object
 */
export function connectionRowToProspect(row: ConnectionRow): Prospect {
  const raw = row.raw_data || {};
  let uiStatus: OutreachStatus = 'Not contacted';
  if (row.status === 'contacted') uiStatus = 'Contacted';
  else if (row.status === 'skipped') uiStatus = 'not_relevant';

  return {
    id: row.id,
    name: row.name || 'Connection',
    jobTitle: row.position || 'Professional',
    company: row.company || 'Company',
    location: row.location || raw.location || 'Remote',
    linkedinUrl: row.linkedin_url,
    email: row.email || undefined,
    phoneNumber: row.phone || undefined,
    connectedOn: row.connected_on || undefined,
    segregationGroup: raw.segregationGroup || 'Employee',
    notes: row.notes || undefined,
    headline: row.headline || undefined,
    classification: raw.classification || 'Other',
    relationshipType: raw.relationshipType || 'Other',
    category: (row.category as any) || raw.category || 'other',
    status: uiStatus,
    score: raw.score || (row.score !== null ? { totalScore: row.score, items: [], strongMatches: [], gaps: [], blockers: [], recommendedAction: 'Recommended Outreach' } : undefined),
    jobOpportunity: raw.jobOpportunity,
    draftedMessage: raw.draftedMessage,
    followUpDay5Message: raw.followUpDay5Message,
    followUpDay12Message: raw.followUpDay12Message,
    lastContactedDate: row.contacted_at ? row.contacted_at.split('T')[0] : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Marks a connection as contacted and schedules Day 5 and Day 12 follow-ups.
 *
 * Contact Flow:
 * 1. connections.status = 'contacted', connections.contacted_at = now()
 * 2. outreach_events:
 *    - type = 'initial', sequence_number = 0, completed_at = now(), scheduled_for = now(), message = initialMessage
 *    - type = 'follow_up', sequence_number = 1, scheduled_for = contacted_at + 5 days, message = followUpDay5
 *    - type = 'follow_up', sequence_number = 2, scheduled_for = contacted_at + 12 days, message = followUpDay12
 */
export async function markConnectionContacted(
  userId: string,
  connectionId: string,
  options: {
    initialMessage?: string;
    followUpDay5?: string;
    followUpDay12?: string;
    contactedDate?: Date;
  }
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const contactedAt = options.contactedDate || new Date();
  const contactedAtIso = contactedAt.toISOString();

  try {
    let targetId = connectionId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId);
    if (!isUuid) {
      const { data: matched } = await client
        .from('connections')
        .select('id')
        .eq('user_id', userId)
        .limit(10);
      const found = (matched || []).find((c: any) => c.raw_data?.id === connectionId);
      if (found?.id) {
        targetId = found.id;
      }
    }

    // 1. Update connections status
    const { error: connError } = await client
      .from('connections')
      .update({
        status: 'contacted',
        contacted_at: contactedAtIso,
        updated_at: contactedAtIso
      })
      .eq('id', targetId)
      .eq('user_id', userId);

    if (connError) {
      console.error('[Supabase] Error updating connection to contacted:', connError);
      return false;
    }

    // 2. Schedule follow-ups (Day 5 and Day 12)
    const day5Date = new Date(contactedAt.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const day12Date = new Date(contactedAt.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString();

    const events: Array<Omit<OutreachEventRow, 'id' | 'created_at'>> = [
      {
        user_id: userId,
        connection_id: targetId,
        type: 'initial',
        sequence_number: 0,
        message: options.initialMessage || null,
        scheduled_for: contactedAtIso,
        completed_at: contactedAtIso
      },
      {
        user_id: userId,
        connection_id: targetId,
        type: 'follow_up',
        sequence_number: 1,
        message: options.followUpDay5 || null,
        scheduled_for: day5Date,
        completed_at: null
      },
      {
        user_id: userId,
        connection_id: targetId,
        type: 'follow_up',
        sequence_number: 2,
        message: options.followUpDay12 || null,
        scheduled_for: day12Date,
        completed_at: null
      }
    ];

    const { error: eventError } = await client.from('outreach_events').insert(events);
    if (eventError) {
      console.error('[Supabase] Error creating outreach_events for contact:', eventError);
    }

    return true;
  } catch (err) {
    console.error('[Supabase] Exception marking connection contacted:', err);
    return false;
  }
}

/**
 * Marks a connection as skipped.
 * Status becomes 'skipped'. It will never appear in the NEW queue or be recreated by future imports.
 */
export async function markConnectionSkipped(
  userId: string,
  connectionId: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const now = new Date().toISOString();
  try {
    let targetId = connectionId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId);
    if (!isUuid) {
      const { data: matched } = await client
        .from('connections')
        .select('id')
        .eq('user_id', userId)
        .limit(10);
      const found = (matched || []).find((c: any) => c.raw_data?.id === connectionId);
      if (found?.id) {
        targetId = found.id;
      }
    }

    const { error } = await client
      .from('connections')
      .update({
        status: 'skipped',
        updated_at: now
      })
      .eq('id', targetId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error updating connection to skipped:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception marking connection skipped:', err);
    return false;
  }
}

/**
 * Query due follow-ups (scheduled_for <= now() and completed_at is null)
 */
export async function getDueFollowUps(userId: string): Promise<DueFollowUp[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const now = new Date().toISOString();
  try {
    const { data, error } = await client
      .from('outreach_events')
      .select(`
        id,
        user_id,
        connection_id,
        type,
        sequence_number,
        message,
        scheduled_for,
        completed_at,
        created_at,
        connections (
          id,
          name,
          company,
          position,
          linkedin_url
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'follow_up')
      .is('completed_at', null)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (error || !data) {
      console.error('[Supabase] Error querying due follow-ups:', error);
      return [];
    }

    return data
      .filter((row: any) => row.connections)
      .map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        connection_id: row.connection_id,
        type: row.type,
        sequence_number: row.sequence_number,
        message: row.message,
        scheduled_for: row.scheduled_for,
        completed_at: row.completed_at,
        created_at: row.created_at,
        name: row.connections?.name || 'Connection',
        company: row.connections?.company || 'Company',
        position: row.connections?.position || 'Professional',
        linkedin_url: row.connections?.linkedin_url || ''
      }));
  } catch (err) {
    console.error('[Supabase] Exception querying due follow-ups:', err);
    return [];
  }
}

/**
 * Query upcoming follow-ups (scheduled_for > now() and completed_at is null)
 */
export async function getUpcomingFollowUps(userId: string): Promise<DueFollowUp[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const now = new Date().toISOString();
  try {
    const { data, error } = await client
      .from('outreach_events')
      .select(`
        id,
        user_id,
        connection_id,
        type,
        sequence_number,
        message,
        scheduled_for,
        completed_at,
        created_at,
        connections (
          id,
          name,
          company,
          position,
          linkedin_url
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'follow_up')
      .is('completed_at', null)
      .gt('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (error || !data) {
      console.error('[Supabase] Error querying upcoming follow-ups:', error);
      return [];
    }

    return data
      .filter((row: any) => row.connections)
      .map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        connection_id: row.connection_id,
        type: row.type,
        sequence_number: row.sequence_number,
        message: row.message,
        scheduled_for: row.scheduled_for,
        completed_at: row.completed_at,
        created_at: row.created_at,
        name: row.connections?.name || 'Connection',
        company: row.connections?.company || 'Company',
        position: row.connections?.position || 'Professional',
        linkedin_url: row.connections?.linkedin_url || ''
      }));
  } catch (err) {
    console.error('[Supabase] Exception querying upcoming follow-ups:', err);
    return [];
  }
}

/**
 * Mark a follow-up event as completed (completed_at = now())
 */
export async function completeFollowUp(userId: string, eventId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const now = new Date().toISOString();
  try {
    const { error } = await client
      .from('outreach_events')
      .update({ completed_at: now })
      .eq('id', eventId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error completing follow-up:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception completing follow-up:', err);
    return false;
  }
}

/**
 * Migrates local prospects from IndexedDB / LocalStorage into Supabase.
 * Respects status precedence rule: contacted > skipped > new.
 * Never overwrites a contacted/skipped record with new.
 */
export async function migrateLocalDataToSupabase(
  userId: string,
  localProspects: Prospect[]
): Promise<{ migratedCount: number; skippedCount: number }> {
  if (!localProspects || localProspects.length === 0) {
    return { migratedCount: 0, skippedCount: 0 };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { migratedCount: 0, skippedCount: 0 };
  }

  // 1. Gather all normalized URLs
  const urlMap = new Map<string, Prospect>();
  for (const p of localProspects) {
    const norm = normalizeLinkedInUrl(p.linkedinUrl, p.name, p.company);
    if (!norm) continue;

    const existing = urlMap.get(norm);
    if (!existing) {
      urlMap.set(norm, p);
    } else {
      // Precedence: Contacted > not_relevant (skipped) > other
      if (p.status === 'Contacted' && existing.status !== 'Contacted') {
        urlMap.set(norm, p);
      } else if (p.status === 'not_relevant' && existing.status !== 'Contacted' && existing.status !== 'not_relevant') {
        urlMap.set(norm, p);
      }
    }
  }

  const allUrls = Array.from(urlMap.keys());
  const existingStatuses = await fetchExistingConnectionStatuses(userId, allUrls);

  const rowsToUpsert: Array<Partial<ConnectionRow>> = [];
  let skippedCount = 0;

  for (const [normUrl, p] of urlMap.entries()) {
    const existingStatus = existingStatuses.get(normUrl);

    let targetStatus: ConnectionStatus = 'new';
    if (p.status === 'Contacted') targetStatus = 'contacted';
    else if (p.status === 'not_relevant') targetStatus = 'skipped';

    // Enforce precedence rule: contacted > skipped > new
    if (existingStatus === 'contacted') {
      // Never downgrade or overwrite a contacted person
      skippedCount++;
      continue;
    }
    if (existingStatus === 'skipped' && targetStatus === 'new') {
      // Never overwrite a skipped person with new
      skippedCount++;
      continue;
    }

    const nameParts = (p.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    rowsToUpsert.push({
      user_id: userId,
      linkedin_url: normUrl,
      name: p.name,
      first_name: firstName,
      last_name: lastName,
      company: p.company,
      position: p.jobTitle,
      email: p.email || null,
      phone: p.phoneNumber || null,
      category: p.category || null,
      score: p.score?.totalScore ?? null,
      connected_on: p.connectedOn ? p.connectedOn.slice(0, 10) : null,
      status: targetStatus,
      contacted_at: p.status === 'Contacted' ? (p.lastContactedDate || p.updatedAt) : null,
      location: p.location || null,
      notes: p.notes || null,
      headline: p.headline || null,
      raw_data: {
        score: p.score,
        jobOpportunity: p.jobOpportunity,
        segregationGroup: p.segregationGroup,
        classification: p.classification,
        relationshipType: p.relationshipType,
        category: p.category,
        draftedMessage: p.draftedMessage,
        followUpDay5Message: p.followUpDay5Message,
        followUpDay12Message: p.followUpDay12Message
      }
    });
  }

  let migratedCount = 0;
  if (rowsToUpsert.length > 0) {
    const res = await insertNewConnections(userId, rowsToUpsert);
    migratedCount = res.count;
  }

  return { migratedCount, skippedCount };
}
