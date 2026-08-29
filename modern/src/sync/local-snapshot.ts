import type { SyncSnapshot } from '../../../src/types/sync';

const PREFIX = 'trilha-flashcard-';

export function readLegacyLocalSnapshot(storage: Storage = window.localStorage): SyncSnapshot {
  const entries: Record<string, string> = {};

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }

  return { version: 1, entries };
}

export function applyLegacyLocalSnapshot(
  snapshot: SyncSnapshot,
  storage: Storage = window.localStorage,
): void {
  const incomingKeys = new Set(Object.keys(snapshot.entries));
  const existingKeys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) existingKeys.push(key);
  }

  for (const key of existingKeys) {
    if (!incomingKeys.has(key)) storage.removeItem(key);
  }

  for (const [key, value] of Object.entries(snapshot.entries)) {
    if (!key.startsWith(PREFIX)) continue;
    storage.setItem(key, value);
  }
}

export function countSnapshotEntries(snapshot: SyncSnapshot): number {
  return Object.keys(snapshot.entries).length;
}
