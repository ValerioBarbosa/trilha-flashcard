import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseSyncAdapter } from '../../../src/services/sync/supabase-sync-adapter';
import type { RemoteSnapshot } from '../../../src/types/sync';
import { applyLegacyLocalSnapshot, readLegacyLocalSnapshot } from './local-snapshot';

export type SyncStatus = {
  busy: boolean;
  lastSyncedAt: string | null;
  remoteUpdatedAt: string | null;
  localEntries: number;
  remoteEntries: number;
  error: string | null;
};

export class SyncController {
  private adapter;
  private status: SyncStatus = {
    busy: false,
    lastSyncedAt: null,
    remoteUpdatedAt: null,
    localEntries: 0,
    remoteEntries: 0,
    error: null,
  };

  constructor(private readonly client: SupabaseClient) {
    this.adapter = createSupabaseSyncAdapter(client);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async inspect(userId: string): Promise<{ status: SyncStatus; remote: RemoteSnapshot }> {
    this.setBusy();
    try {
      const local = readLegacyLocalSnapshot();
      const remote = await this.adapter.read(userId);
      this.status = {
        busy: false,
        lastSyncedAt: this.status.lastSyncedAt,
        remoteUpdatedAt: remote?.updatedAtISO ?? null,
        localEntries: Object.keys(local.entries).length,
        remoteEntries: Object.keys(remote?.snapshot.entries ?? {}).length,
        error: null,
      };
      return { status: this.status, remote };
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  async pushLocal(userId: string, expectedUpdatedAtISO: string | null, force = false): Promise<SyncStatus> {
    this.setBusy();
    try {
      const local = readLegacyLocalSnapshot();
      const token = await this.adapter.write(userId, local, {
        expectedUpdatedAtISO,
        force,
      });
      this.status = {
        busy: false,
        lastSyncedAt: new Date().toISOString(),
        remoteUpdatedAt: token,
        localEntries: Object.keys(local.entries).length,
        remoteEntries: Object.keys(local.entries).length,
        error: null,
      };
      return this.status;
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  async pullRemote(userId: string): Promise<SyncStatus> {
    this.setBusy();
    try {
      const remote = await this.adapter.read(userId);
      if (remote) applyLegacyLocalSnapshot(remote.snapshot);
      const local = readLegacyLocalSnapshot();
      this.status = {
        busy: false,
        lastSyncedAt: new Date().toISOString(),
        remoteUpdatedAt: remote?.updatedAtISO ?? null,
        localEntries: Object.keys(local.entries).length,
        remoteEntries: Object.keys(remote?.snapshot.entries ?? {}).length,
        error: null,
      };
      return this.status;
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  private setBusy(): void {
    this.status = { ...this.status, busy: true, error: null };
  }

  private setError(error: unknown): void {
    this.status = {
      ...this.status,
      busy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
