import type { SyncSnapshot } from '../../../src/types/sync';

const PREFIX = 'trilha-flashcard-';
const EXCLUDED_KEYS = new Set([
  'trilha-flashcard-theme',
  'trilha-flashcard-cloud-meta',
]);

export function isSyncableKey(key: string): boolean {
  return key.startsWith(PREFIX) && !EXCLUDED_KEYS.has(key);
}

export function readLegacyLocalSnapshot(storage: Storage = window.localStorage): SyncSnapshot {
  const entries: Record<string, string> = {};
  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isSyncableKey(key)) keys.push(key);
  }

  keys.sort();
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }

  return { version: 1, entries };
}

export function applyLegacyLocalSnapshot(
  snapshot: SyncSnapshot,
  storage: Storage = window.localStorage,
): void {
  if (!snapshot || snapshot.version !== 1 || !snapshot.entries) {
    throw new Error('invalid-cloud-snapshot');
  }

  const incomingKeys = new Set(Object.keys(snapshot.entries).filter(isSyncableKey));
  const existingKeys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isSyncableKey(key)) existingKeys.push(key);
  }

  for (const key of existingKeys) {
    if (!incomingKeys.has(key)) storage.removeItem(key);
  }

  for (const [key, value] of Object.entries(snapshot.entries)) {
    if (!isSyncableKey(key) || typeof value !== 'string') continue;
    storage.setItem(key, value);
  }
}

export function countSnapshotEntries(snapshot: SyncSnapshot): number {
  return Object.keys(snapshot.entries).length;
}
