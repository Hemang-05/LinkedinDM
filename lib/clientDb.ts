/**
 * Client-Side IndexedDB Data Store (namespace: directmessage_prospects_v1)
 *
 * Replaces the old shared server-side jobhunt_data.json and outreach_log.txt.
 * All prospects, statuses, review queues, notes, and outreach logs live
 * exclusively within the user's browser, preventing cross-user data leakage.
 */

import { Prospect, OutreachStatus, OutreachLogEntry } from '@/types';
import { getClientProfile, saveClientProfile } from './clientStorage';

const DB_NAME = 'directmessage_prospects_v1';
const DB_VERSION = 1;
const PROSPECTS_STORE = 'prospects';
const LOGS_STORE = 'outreach_logs';

// Memory cache for SSR or environments where indexedDB is not available
let memoryProspects: Prospect[] = [];
let memoryLogs: OutreachLogEntry[] = [];

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB not available in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROSPECTS_STORE)) {
        db.createObjectStore(PROSPECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve all prospects from IndexedDB
 */
export async function getAllProspects(): Promise<Prospect[]> {
  if (!isIndexedDBAvailable()) {
    return [...memoryProspects];
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROSPECTS_STORE, 'readonly');
      const store = tx.objectStore(PROSPECTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed reading from IndexedDB, using memory store:', err);
    return [...memoryProspects];
  }
}

/**
 * Bulk save/update prospects into IndexedDB
 */
export async function saveProspects(prospects: Prospect[]): Promise<void> {
  if (!prospects || prospects.length === 0) return;

  if (!isIndexedDBAvailable()) {
    const map = new Map<string, Prospect>();
    for (const p of memoryProspects) map.set(p.id, p);
    for (const p of prospects) map.set(p.id, p);
    memoryProspects = Array.from(map.values());
    return;
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROSPECTS_STORE, 'readwrite');
      const store = tx.objectStore(PROSPECTS_STORE);

      for (const p of prospects) {
        store.put(p);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed writing prospects to IndexedDB:', err);
  }
}

/**
 * Update a single prospect's outreach status, notes, or drafted message
 */
export async function updateProspectStatusInDb(
  id: string,
  newStatus: OutreachStatus,
  updatedMessage?: string
): Promise<Prospect | null> {
  const now = new Date().toISOString();

  if (!isIndexedDBAvailable()) {
    const idx = memoryProspects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    memoryProspects[idx].status = newStatus;
    memoryProspects[idx].updatedAt = now;
    if (updatedMessage !== undefined) {
      memoryProspects[idx].draftedMessage = updatedMessage;
    }
    if (newStatus === 'Contacted') {
      memoryProspects[idx].lastContactedDate = now.split('T')[0];
    }
    return memoryProspects[idx];
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROSPECTS_STORE, 'readwrite');
      const store = tx.objectStore(PROSPECTS_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const prospect = getReq.result as Prospect | undefined;
        if (!prospect) {
          return resolve(null);
        }

        prospect.status = newStatus;
        prospect.updatedAt = now;
        if (updatedMessage !== undefined) {
          prospect.draftedMessage = updatedMessage;
        }
        if (newStatus === 'Contacted') {
          prospect.lastContactedDate = now.split('T')[0];
        }

        const putReq = store.put(prospect);
        putReq.onsuccess = () => resolve(prospect);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Failed updating prospect in IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieve all outreach logs
 */
export async function getAllOutreachLogs(): Promise<OutreachLogEntry[]> {
  if (!isIndexedDBAvailable()) {
    return [...memoryLogs];
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOGS_STORE, 'readonly');
      const store = tx.objectStore(LOGS_STORE);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed reading logs from IndexedDB:', err);
    return [...memoryLogs];
  }
}

/**
 * Append an outreach log entry
 */
export async function addOutreachLog(entry: OutreachLogEntry): Promise<void> {
  if (!isIndexedDBAvailable()) {
    memoryLogs.push(entry);
    return;
  }

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOGS_STORE, 'readwrite');
      const store = tx.objectStore(LOGS_STORE);
      const req = store.add(entry);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed appending outreach log to IndexedDB:', err);
  }
}

export const LAST_EXPORT_KEY = 'directmessage_last_exported_at';
let memoryLastExported: string | null = null;

export function getLastExportedDate(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(LAST_EXPORT_KEY);
    } catch {
      return memoryLastExported;
    }
  }
  return memoryLastExported;
}

export function recordExportDate(): string {
  const nowIso = new Date().toISOString();
  memoryLastExported = nowIso;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_EXPORT_KEY, nowIso);
    } catch {}
  }
  return nowIso;
}

/**
 * Requests browser storage persistence via navigator.storage.persist()
 * Called after user's first import to prevent automatic browser data eviction.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        const isAlreadyPersisted = await navigator.storage.persisted();
        if (isAlreadyPersisted) return true;
      }
      const granted = await navigator.storage.persist();
      console.log(`[Storage] Storage persistence granted: ${granted}`);
      return granted;
    } catch (e) {
      console.warn('[Storage] navigator.storage.persist error:', e);
    }
  }
  return false;
}

/**
 * Export complete user data (profile, prospects, outreach logs) as JSON string
 */
export async function exportUserDataJson(): Promise<string> {
  const prospects = await getAllProspects();
  const logs = await getAllOutreachLogs();
  const profile = getClientProfile();

  const exportPayload = {
    app: 'directmessage',
    namespace: DB_NAME,
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    prospects,
    outreachLogs: logs
  };

  recordExportDate();
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Import and restore user data from an exported JSON string
 */
export async function importUserDataJson(
  jsonString: string
): Promise<{ prospectsCount: number; logsCount: number }> {
  const parsed = JSON.parse(jsonString);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file format: Root must be an object.');
  }

  if (parsed.profile) {
    saveClientProfile(parsed.profile);
  }

  let prospectsCount = 0;
  if (Array.isArray(parsed.prospects) && parsed.prospects.length > 0) {
    await saveProspects(parsed.prospects);
    prospectsCount = parsed.prospects.length;
  }

  let logsCount = 0;
  if (Array.isArray(parsed.outreachLogs) && parsed.outreachLogs.length > 0) {
    for (const log of parsed.outreachLogs) {
      await addOutreachLog(log);
      logsCount++;
    }
  }

  // Request persistent storage after restoring backup
  await requestStoragePersistence();

  return { prospectsCount, logsCount };
}

/**
 * Completely clear user's local prospects and logs
 */
export async function clearUserData(): Promise<void> {
  memoryProspects = [];
  memoryLogs = [];

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PROSPECTS_STORE, LOGS_STORE], 'readwrite');
      tx.objectStore(PROSPECTS_STORE).clear();
      tx.objectStore(LOGS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed clearing IndexedDB:', err);
  }
}
