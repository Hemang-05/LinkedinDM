import fs from 'fs';
import path from 'path';
import { OutreachLogEntry, RelationshipType, OutreachStatus } from '@/types';

const LOG_FILE_PATH = path.join(process.cwd(), 'outreach_log.txt');

export function ensureLogFileExists(): void {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      fs.writeFileSync(LOG_FILE_PATH, '', 'utf8');
    }
  } catch (err) {
    console.error('Error creating outreach_log.txt:', err);
  }
}

export function parseOutreachLog(): OutreachLogEntry[] {
  try {
    ensureLogFileExists();
    const content = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    if (!content.trim()) return [];

    const blocks = content.split(/={40,}/).map(b => b.trim()).filter(Boolean);
    const entries: OutreachLogEntry[] = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const entry: Partial<OutreachLogEntry> = { rawText: block };

      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim();

        if (key === 'date') entry.date = val;
        else if (key === 'name') entry.name = val;
        else if (key === 'company') entry.company = val;
        else if (key === 'role' || key === 'role being hired for') entry.role = val;
        else if (key === "person's position" || key === 'person position') entry.personPosition = val;
        else if (key === 'relationship type') entry.relationshipType = val as RelationshipType;
        else if (key === 'linkedin') entry.linkedinUrl = val;
        else if (key === 'message status') entry.status = val as OutreachStatus;
      }

      if (entry.name && entry.company) {
        entries.push(entry as OutreachLogEntry);
      }
    }

    return entries.reverse(); // Most recent first
  } catch (err) {
    console.error('Error reading outreach_log.txt:', err);
    return [];
  }
}

export function checkDuplicateContact(
  linkedinUrl: string,
  name: string,
  company: string
): { isDuplicate: boolean; existingEntry?: OutreachLogEntry } {
  const entries = parseOutreachLog();
  const cleanUrl = linkedinUrl?.trim().toLowerCase().replace(/\/+$/, '');
  const cleanName = name?.trim().toLowerCase();
  const cleanCompany = company?.trim().toLowerCase();

  for (const entry of entries) {
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

export function appendOutreachLog(entry: OutreachLogEntry): void {
  ensureLogFileExists();
  const formattedDate = entry.date || new Date().toISOString().split('T')[0];

  const formattedBlock = `==================================================
Date: ${formattedDate}

Name: ${entry.name}
Company: ${entry.company}
Role being hired for: ${entry.role}
Person's Position: ${entry.personPosition}
Relationship Type: ${entry.relationshipType}
LinkedIn: ${entry.linkedinUrl}
Message Status: ${entry.status || 'Contacted'}
==================================================\n\n`;

  fs.appendFileSync(LOG_FILE_PATH, formattedBlock, 'utf8');
}

export function updateOutreachLogStatus(
  linkedinUrl: string,
  name: string,
  company: string,
  newStatus: OutreachStatus
): boolean {
  try {
    ensureLogFileExists();
    let content = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    if (!content.trim()) return false;

    const blocks = content.split(/={40,}/).map(b => b.trim()).filter(Boolean);
    let updated = false;

    const newBlocks = blocks.map(block => {
      const matchUrl = linkedinUrl && block.includes(linkedinUrl);
      const matchNameComp =
        name &&
        company &&
        block.toLowerCase().includes(name.toLowerCase()) &&
        block.toLowerCase().includes(company.toLowerCase());

      if (matchUrl || matchNameComp) {
        updated = true;
        return block.replace(/Message Status:\s*[^\n]+/i, `Message Status: ${newStatus}`);
      }
      return block;
    });

    if (updated) {
      const updatedContent = newBlocks
        .map(b => `==================================================\n${b}\n==================================================\n\n`)
        .join('');
      fs.writeFileSync(LOG_FILE_PATH, updatedContent, 'utf8');
    }

    return updated;
  } catch (err) {
    console.error('Error updating status in outreach_log.txt:', err);
    return false;
  }
}
