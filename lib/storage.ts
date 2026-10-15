import { Prospect, OutreachStatus } from '@/types';

/**
 * Storage has moved entirely client-side to IndexedDB (namespace: directmessage_prospects_v1).
 * Server API routes are completely stateless and do not persist shared files on disk.
 */

export function getStoredProspects(): Prospect[] {
  return [];
}

export function saveStoredProspects(_prospects: Prospect[]): void {
  // No-op: client manages persistence in IndexedDB
}

export function updateProspectStatus(id: string, newStatus: OutreachStatus, updatedMessage?: string): Prospect | null {
  return null;
}

export function addProspect(prospect: Prospect): Prospect {
  return prospect;
}
