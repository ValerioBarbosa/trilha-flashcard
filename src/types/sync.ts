export type SyncEntry = {
  storageKey: string;
  storageValue: string | null;
  contentHash: string;
  deleted: boolean;
  updatedAt: string;
};

export type SyncSnapshot = {
  version: 1;
  entries: Record<string, string>;
};

export type RemoteSnapshot = {
  updatedAtISO: string;
  snapshot: SyncSnapshot;
} | null;

export type SyncWriteOptions = {
  expectedUpdatedAtISO?: string | null;
  force?: boolean;
};

export interface SyncAdapter {
  readonly provider: 'supabase';
  read(userId: string): Promise<RemoteSnapshot>;
  write(userId: string, snapshot: SyncSnapshot, options?: SyncWriteOptions): Promise<string>;
}
