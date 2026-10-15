import { Prospect, OutreachLogEntry, OutreachStatus, UserProfile, OutreachGoal, NotRelevantReason } from '@/types';
import { INITIAL_PROSPECTS } from './sampleData';
import { EMPTY_PROFILE } from './profile';

const PROSPECTS_STORAGE_KEY = 'directmessage_prospects_v2';
const OUTREACH_STORAGE_KEY = 'directmessage_outreach_v2';
const PROFILE_STORAGE_KEY = 'directmessage_user_profile_v3';

export function getClientProspects(): Prospect[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(PROSPECTS_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read prospects from localStorage:', err);
    return [];
  }
}

export function saveClientProspects(prospects: Prospect[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(prospects));
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
  notRelevantReason?: NotRelevantReason
): Prospect | null {
  const list = getClientProspects();
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

  saveClientProspects(list);

  if (typeof window !== 'undefined') {
    import('./clientDb')
      .then(({ updateProspectStatusInDb }) => {
        updateProspectStatusInDb(id, newStatus, updatedMessage);
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

export function getClientOutreachLogs(): OutreachLogEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(OUTREACH_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read outreach logs from localStorage:', err);
    return [];
  }
}

export function saveClientOutreachLogs(logs: OutreachLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTREACH_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save outreach logs to localStorage:', err);
  }
}

export function isProfileComplete(profile: UserProfile | null | undefined, goal: OutreachGoal = 'job-hunt'): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.name && profile.name.trim().length > 0 && profile.name.trim() !== 'Your Name');
  const hasRole = Boolean((profile.targetRole && profile.targetRole.trim()) || (profile.title && profile.title.trim()));
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasExp = typeof profile.yearsOfExperience === 'number' && !isNaN(profile.yearsOfExperience) && profile.yearsOfExperience >= 0;
  if (!hasName || !hasRole || !hasSkills || !hasExp) return false;
  if (goal === 'agency-leads') {
    const hasAgencySummary = Boolean(profile.agencyServiceSummary && profile.agencyServiceSummary.trim());
    const hasAgencyOffering = Boolean(profile.agencyOffering && profile.agencyOffering.trim());
    if (!hasAgencySummary || !hasAgencyOffering) return false;
  }
  return true;
}

export function getClientProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(PROFILE_STORAGE_KEY);
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

export function saveClientProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save profile to localStorage:', err);
  }
}

export function checkClientDuplicate(
  linkedinUrl: string,
  name: string,
  company: string
): { isDuplicate: boolean; existingEntry?: OutreachLogEntry } {
  const logs = getClientOutreachLogs();
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

export function appendClientOutreachLog(entry: OutreachLogEntry): void {
  const logs = getClientOutreachLogs();
  const formattedDate = entry.date || new Date().toISOString().split('T')[0];
  const newEntry: OutreachLogEntry = {
    ...entry,
    date: formattedDate
  };
  const updated = [newEntry, ...logs];
  saveClientOutreachLogs(updated);
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

export function getClientSession(): ClientSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveClientSession(session: Partial<ClientSession>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getClientSession() || {
      selectedWorkflow: null,
      workflowStep: 'upload'
    };
    const updated = { ...existing, ...session };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

export function clearClientSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}
