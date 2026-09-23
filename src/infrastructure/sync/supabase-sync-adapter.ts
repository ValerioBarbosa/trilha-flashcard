import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteSnapshot, SyncAdapter, SyncSnapshot, SyncWriteOptions } from '../../types/sync';

const TABLE = 'flashcard_sync_entries';
const PAGE_SIZE = 1000;

type SyncRow = {
  storage_key: string;
  storage_value: string | null;
  content_hash: string;
  deleted: boolean;
  updated_at: string;
};

function contentHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function rowsToRemote(rows: SyncRow[]): RemoteSnapshot {
  if (rows.length === 0) return null;

  const entries: Record<string, string> = {};
  let updatedAtISO = '';

  for (const row of rows) {
    if (!row.deleted && typeof row.storage_value === 'string') {
      entries[row.storage_key] = row.storage_value;
    }
    if (row.updated_at > updatedAtISO) updatedAtISO = row.updated_at;
  }

  return {
    updatedAtISO,
    snapshot: { version: 1, entries },
  };
}

function buildChangedRows(userId: string, snapshot: SyncSnapshot, remoteRows: SyncRow[]) {
  const remoteByKey = new Map(remoteRows.map((row) => [row.storage_key, row]));
  const changed: Array<Record<string, unknown>> = [];

  for (const [storageKey, storageValue] of Object.entries(snapshot.entries)) {
    const nextHash = contentHash(storageValue);
    const previous = remoteByKey.get(storageKey);

    if (!previous || previous.deleted || previous.content_hash !== nextHash) {
      changed.push({
        user_id: userId,
        storage_key: storageKey,
        storage_value: storageValue,
        content_hash: nextHash,
        deleted: false,
      });
    }

    remoteByKey.delete(storageKey);
  }

  for (const [storageKey, previous] of remoteByKey) {
    if (!previous.deleted) {
      changed.push({
        user_id: userId,
        storage_key: storageKey,
        storage_value: null,
        content_hash: contentHash(''),
        deleted: true,
      });
    }
  }

  return changed;
}

export function createSupabaseSyncAdapter(client: SupabaseClient): SyncAdapter {
  async function fetchRows(userId: string): Promise<SyncRow[]> {
    const rows: SyncRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(TABLE)
        .select('storage_key,storage_value,content_hash,deleted,updated_at')
        .eq('user_id', userId)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as SyncRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  return {
    provider: 'supabase',

    async read(userId: string) {
      return rowsToRemote(await fetchRows(userId));
    },

    async write(userId: string, snapshot: SyncSnapshot, options: SyncWriteOptions = {}) {
      const remoteRows = await fetchRows(userId);
      const remote = rowsToRemote(remoteRows);
      const remoteToken = remote?.updatedAtISO ?? null;
      const expected = options.expectedUpdatedAtISO ?? null;

      if (!options.force && remoteToken !== expected) {
        throw new Error('cloud-conflict');
      }

      const changedRows = buildChangedRows(userId, snapshot, remoteRows);
      if (changedRows.length === 0) return remoteToken ?? new Date().toISOString();

      let serverToken = '';
      for (let start = 0; start < changedRows.length; start += 500) {
        const { data, error } = await client
          .from(TABLE)
          .upsert(changedRows.slice(start, start + 500), { onConflict: 'user_id,storage_key' })
          .select('updated_at');
        if (error) throw error;
        for (const row of data ?? []) {
          const value = String(row.updated_at ?? '');
          if (value > serverToken) serverToken = value;
        }
      }

      return serverToken || remoteToken || new Date().toISOString();
    },
  };
}

export { buildChangedRows, contentHash, rowsToRemote };
