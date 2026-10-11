import { Prospect, OutreachLogEntry, OutreachStatus, UserProfile } from '@/types';
import { INITIAL_PROSPECTS } from './sampleData';
import { DEFAULT_PROFILE } from './profile';

const PROSPECTS_STORAGE_KEY = 'directmessage_prospects_v2';
const OUTREACH_STORAGE_KEY = 'directmessage_outreach_v2';
const PROFILE_STORAGE_KEY = 'directmessage_user_profile_v2';

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
  } catch (err) {
    console.error('Failed to save prospects to localStorage:', err);
  }
}

export function updateClientProspect(
  id: string,
  newStatus: OutreachStatus,
  updatedMessage?: string
): Prospect | null {
  const list = getClientProspects();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  list[idx].status = newStatus;
  list[idx].updatedAt = now;
  if (updatedMessage !== undefined) {
    list[idx].draftedMessage = updatedMessage;
  }
  if (newStatus === 'Contacted') {
    list[idx].lastContactedDate = now.split('T')[0];
  }

  saveClientProspects(list);
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

export function getClientProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;

  try {
    const data = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!data) return DEFAULT_PROFILE;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PROFILE;

    const name = (!parsed.name || parsed.name === 'Your Name') ? DEFAULT_PROFILE.name : parsed.name;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      name,
      targetRole: parsed.targetRole || DEFAULT_PROFILE.targetRole || 'Full Stack Engineer'
    };
  } catch (err) {
    return DEFAULT_PROFILE;
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
