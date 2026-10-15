import { OutreachLogEntry, OutreachStatus } from '@/types';

/**
 * Outreach logs are persisted client-side in IndexedDB (namespace: directmessage_prospects_v1).
 * Server utilities are stateless memory helpers with no filesystem reads or writes.
 */

export function parseOutreachLog(): OutreachLogEntry[] {
  return [];
}

export function checkDuplicateContact(
  _linkedinUrl: string,
  _name: string,
  _company: string
): { isDuplicate: boolean; existingEntry?: OutreachLogEntry } {
  return { isDuplicate: false };
}

export function appendOutreachLog(_entry: OutreachLogEntry): void {
  // Stateless: persisted client-side in IndexedDB
}

export function updateOutreachLogStatus(
  _linkedinUrl: string,
  _name: string,
  _company: string,
  _newStatus: OutreachStatus
): boolean {
  return true;
}
