import type { BackupPayload } from './backup';

const DB_NAME = 'trilha-local-safety';
const STORE = 'backups';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb-unavailable'));
  });
}

export async function saveAutomaticBackup(profileId: string, payload: BackupPayload): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(payload, profileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('backup-write-failed'));
  });
  db.close();
  try { localStorage.setItem(`trilha-auto-backup-at:${profileId}`, payload.exportedAt); } catch { /* optional */ }
}

export function automaticBackupAt(profileId: string): string | null {
  try { return localStorage.getItem(`trilha-auto-backup-at:${profileId}`); } catch { return null; }
}

export function automaticBackupDue(profileId: string, intervalMs = 24 * 60 * 60 * 1000): boolean {
  const last = automaticBackupAt(profileId);
  return !last || Date.now() - new Date(last).getTime() >= intervalMs;
}
