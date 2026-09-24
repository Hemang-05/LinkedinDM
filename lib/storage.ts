import fs from 'fs';
import path from 'path';
import { Prospect, OutreachStatus } from '@/types';
import { INITIAL_PROSPECTS } from './sampleData';

const DATA_FILE_PATH = path.join(process.cwd(), 'jobhunt_data.json');

export function getStoredProspects(): Prospect[] {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(INITIAL_PROSPECTS, null, 2), 'utf8');
      return INITIAL_PROSPECTS;
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    if (!raw.trim()) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(INITIAL_PROSPECTS, null, 2), 'utf8');
      return INITIAL_PROSPECTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading jobhunt_data.json, returning initial:', err);
    return INITIAL_PROSPECTS;
  }
}

export function saveStoredProspects(prospects: Prospect[]): void {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(prospects, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed saving to jobhunt_data.json:', err);
  }
}

export function updateProspectStatus(id: string, newStatus: OutreachStatus, updatedMessage?: string): Prospect | null {
  const prospects = getStoredProspects();
  const idx = prospects.findIndex(p => p.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  prospects[idx].status = newStatus;
  prospects[idx].updatedAt = now;
  if (updatedMessage !== undefined) {
    prospects[idx].draftedMessage = updatedMessage;
  }
  if (newStatus === 'Contacted') {
    prospects[idx].lastContactedDate = now.split('T')[0];
  }

  saveStoredProspects(prospects);
  return prospects[idx];
}

export function addProspect(prospect: Prospect): Prospect {
  const prospects = getStoredProspects();
  prospects.unshift(prospect);
  saveStoredProspects(prospects);
  return prospect;
}
