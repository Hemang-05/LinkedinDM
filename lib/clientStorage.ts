import { Prospect, OutreachLogEntry, OutreachStatus, UserProfile, OutreachGoal, NotRelevantReason } from '@/types';
import { INITIAL_PROSPECTS } from './sampleData';
import { EMPTY_PROFILE } from './profile';

let activeStorageUserId: string | null = null;

export function setActiveStorageUser(userId: string | null): void {
  activeStorageUserId = userId;
}

export function getActiveStorageUser(): string | null {
  return activeStorageUserId;
}

function resolveKey(base: string, explicitUserId?: string): string {
  const uid = explicitUserId || activeStorageUserId;
  return uid ? `dm_u_${uid}_${base}` : `directmessage_${base}_v2`;
}

export function clearUserCache(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`dm_u_${userId}_prospects`);
    localStorage.removeItem(`dm_u_${userId}_outreach`);
    localStorage.removeItem(`dm_u_${userId}_profile`);
    localStorage.removeItem(`dm_u_${userId}_session`);
  } catch {}
}

export function getLegacyUnmigratedProspects(): Prospect[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('directmessage_prospects_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('directmessage_prospects_v2');
    localStorage.removeItem('directmessage_outreach_v2');
    localStorage.removeItem('directmessage_user_profile_v3');
  } catch {}
}

export function getClientProspects(userId?: string): Prospect[] {
  if (typeof window === 'undefined') return [];

  try {
    const key = resolveKey('prospects', userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read prospects from localStorage:', err);
    return [];
  }
}

export function saveClientProspects(prospects: Prospect[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = resolveKey('prospects', userId);
    localStorage.setItem(key, JSON.stringify(prospects));
    import('./clientDb')
      .then(({ saveProspects }) => {
        saveProspects(prospects);
      })
      .catch(() => {});
  } catch (err) {
    console.error('Failed to save prospects to localStorage:', err);
  }
}

export function updateClientProspect(
  id: string,
  newStatus: OutreachStatus,
  updatedMessage?: string,
  notRelevantReason?: NotRelevantReason,
  userId?: string
): Prospect | null {
  const effectiveUserId = userId || activeStorageUserId;
  const list = getClientProspects(effectiveUserId || undefined);
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  list[idx].status = newStatus;
  list[idx].updatedAt = now;
  if (notRelevantReason !== undefined) {
    list[idx].notRelevantReason = notRelevantReason;
  }
  if (updatedMessage !== undefined) {
    list[idx].draftedMessage = updatedMessage;
  }
  if (newStatus === 'Contacted') {
    list[idx].lastContactedDate = now.split('T')[0];
  }

  saveClientProspects(list, effectiveUserId || undefined);

  if (typeof window !== 'undefined') {
    // 1. Maintain IndexedDB cache
    import('./clientDb')
      .then(({ updateProspectStatusInDb }) => {
        updateProspectStatusInDb(id, newStatus, updatedMessage);
      })
      .catch(() => {});

    // 2. Persist state to Supabase PostgreSQL (Source of Truth)
    import('./supabaseClient')
      .then(({ getCurrentSupabaseUser }) => {
        getCurrentSupabaseUser().then((user) => {
          if (!user) return;
          import('./supabaseDb').then(({ markConnectionContacted, markConnectionSkipped }) => {
            if (newStatus === 'Contacted') {
              markConnectionContacted(user.id, id, {
                initialMessage: list[idx].draftedMessage,
                followUpDay5: list[idx].followUpDay5Message,
                followUpDay12: list[idx].followUpDay12Message
              });
            } else if (newStatus === 'not_relevant') {
              markConnectionSkipped(user.id, id);
            }
          });
        });
      })
      .catch(() => {});
  }

  return list[idx];
}

export function addClientProspect(prospect: Prospect): Prospect {
  const list = getClientProspects();
  const updated = [prospect, ...list];
  saveClientProspects(updated);
  return prospect;
}

export function getClientOutreachLogs(userId?: string): OutreachLogEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const key = resolveKey('outreach', userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Deduplicate entries by normalized LinkedIn URL or name|company
    const seen = new Set<string>();
    const deduplicated: OutreachLogEntry[] = [];
    for (const entry of parsed) {
      const cleanUrl = entry.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
      const itemKey = (cleanUrl && cleanUrl.includes('linkedin.com/in/'))
        ? cleanUrl
        : `${entry.name?.trim().toLowerCase()}|${entry.company?.trim().toLowerCase()}`;
      if (!seen.has(itemKey)) {
        seen.add(itemKey);
        deduplicated.push(entry);
      }
    }
    return deduplicated;
  } catch (err) {
    console.error('Failed to read outreach logs from localStorage:', err);
    return [];
  }
}

export function saveClientOutreachLogs(logs: OutreachLogEntry[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = resolveKey('outreach', userId);
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save outreach logs to localStorage:', err);
  }
}

export function isProfileComplete(profile: UserProfile | null | undefined, goal: OutreachGoal = 'job-hunt'): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.name && profile.name.trim().length > 0 && profile.name.trim() !== 'Your Name');
  const hasRole = Boolean((profile.targetRole && profile.targetRole.trim()) || (profile.title && profile.title.trim()));
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  if (!hasName || !hasRole) return false;
  if (goal === 'agency-leads') {
    const hasAgencySummary = Boolean(profile.agencyServiceSummary && profile.agencyServiceSummary.trim());
    const hasAgencyOffering = Boolean(profile.agencyOffering && profile.agencyOffering.trim());
    if (!hasAgencySummary || !hasAgencyOffering) return false;
  }
  return true;
}

export function getClientProfile(userId?: string): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = resolveKey('profile', userId);
    const data = localStorage.getItem(key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.name || typeof parsed.name !== 'string' || !parsed.name.trim()) return null;

    return {
      ...EMPTY_PROFILE,
      ...parsed
    };
  } catch (err) {
    return null;
  }
}

export function saveClientProfile(profile: UserProfile, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const effectiveUserId = userId || activeStorageUserId;
    const key = resolveKey('profile', effectiveUserId || undefined);
    localStorage.setItem(key, JSON.stringify(profile));

    // Sync profile to Supabase if authenticated
    import('./supabaseClient')
      .then(({ getCurrentSupabaseUser }) => {
        getCurrentSupabaseUser().then((user) => {
          const targetUid = user?.id || effectiveUserId;
          if (!targetUid) return;
          import('./supabaseDb').then(({ saveSupabaseProfile }) => {
            saveSupabaseProfile(targetUid, profile, user?.email);
          });
        });
      })
      .catch(() => {});
  } catch (err) {
    console.error('Failed to save profile to localStorage:', err);
  }
}

export function checkClientDuplicate(
  linkedinUrl: string,
  name: string,
  company: string,
  userId?: string
): { isDuplicate: boolean; existingEntry?: OutreachLogEntry } {
  const effectiveUserId = userId || activeStorageUserId;
  const logs = getClientOutreachLogs(effectiveUserId || undefined);
  const cleanUrl = linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
  const cleanName = name?.trim().toLowerCase();
  const cleanCompany = company?.trim().toLowerCase();

  for (const entry of logs) {
    const entryUrl = entry.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
    if (cleanUrl && entryUrl && cleanUrl === entryUrl) {
      return { isDuplicate: true, existingEntry: entry };
    }
    if (
      cleanName &&
      cleanCompany &&
      entry.name.toLowerCase() === cleanName &&
      entry.company.toLowerCase() === cleanCompany
    ) {
      return { isDuplicate: true, existingEntry: entry };
    }
  }

  return { isDuplicate: false };
}

export function appendClientOutreachLog(entry: OutreachLogEntry, userId?: string): void {
  const effectiveUserId = userId || activeStorageUserId;
  const logs = getClientOutreachLogs(effectiveUserId || undefined);

  // Prevent duplicate outreach entries for the same prospect
  const { isDuplicate } = checkClientDuplicate(entry.linkedinUrl, entry.name, entry.company, effectiveUserId || undefined);
  if (isDuplicate) {
    const cleanUrl = entry.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
    const cleanName = entry.name?.trim().toLowerCase();
    const cleanCompany = entry.company?.trim().toLowerCase();

    const updated = logs.map((existing) => {
      const existingUrl = existing.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
      const matchUrl = cleanUrl && existingUrl && cleanUrl === existingUrl;
      const matchName =
        cleanName &&
        cleanCompany &&
        existing.name.toLowerCase() === cleanName &&
        existing.company.toLowerCase() === cleanCompany;

      if (matchUrl || matchName) {
        return { ...existing, ...entry, date: entry.date || existing.date };
      }
      return existing;
    });
    saveClientOutreachLogs(updated, effectiveUserId || undefined);
    return;
  }

  const formattedDate = entry.date || new Date().toISOString().split('T')[0];
  const newEntry: OutreachLogEntry = {
    ...entry,
    date: formattedDate
  };
  const updated = [newEntry, ...logs];
  saveClientOutreachLogs(updated, effectiveUserId || undefined);
}

export function updateClientOutreachStatus(
  linkedinUrl: string,
  name: string,
  company: string,
  newStatus: OutreachStatus
): boolean {
  const logs = getClientOutreachLogs();
  let found = false;

  const cleanUrl = linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
  const cleanName = name?.trim().toLowerCase();
  const cleanCompany = company?.trim().toLowerCase();

  const updated = logs.map((entry) => {
    const entryUrl = entry.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
    const matchUrl = cleanUrl && entryUrl && cleanUrl === entryUrl;
    const matchName =
      cleanName &&
      cleanCompany &&
      entry.name.toLowerCase() === cleanName &&
      entry.company.toLowerCase() === cleanCompany;

    if (matchUrl || matchName) {
      found = true;
      return { ...entry, status: newStatus };
    }
    return entry;
  });

  if (found) {
    saveClientOutreachLogs(updated);
  }
  return found;
}

export function generateOutreachLogText(logs?: OutreachLogEntry[]): string {
  const list = logs || getClientOutreachLogs();
  if (list.length === 0) return '';

  return list
    .map(
      (entry) => `==================================================
Date: ${entry.date}

Name: ${entry.name}
Company: ${entry.company}
Role being hired for: ${entry.role}
Person's Position: ${entry.personPosition}
Relationship Type: ${entry.relationshipType}
LinkedIn: ${entry.linkedinUrl}
Message Status: ${entry.status}
==================================================\n`
    )
    .join('\n');
}

export function downloadOutreachLogFile(): void {
  const text = generateOutreachLogText();
  if (!text) {
    alert('No outreach history logged yet.');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'outreach_log.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export {
  requestStoragePersistence,
  getLastExportedDate,
  recordExportDate
} from './clientDb';

export interface ClientSession {
  selectedWorkflow: OutreachGoal | null;
  workflowStep: 'upload' | 'segregated';
  currentTab?: string;
  prospectsViewMode?: 'queue' | 'grid';
}

const SESSION_STORAGE_KEY = 'directmessage_ui_session_v1';

export function getClientSession(userId?: string): ClientSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = resolveKey('session', userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveClientSession(session: Partial<ClientSession>, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = resolveKey('session', userId);
    const existing = getClientSession(userId) || {
      selectedWorkflow: null,
      workflowStep: 'upload'
    };
    const updated = { ...existing, ...session };
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

export function clearClientSession(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = resolveKey('session', userId);
    localStorage.removeItem(key);
  } catch {}
}
