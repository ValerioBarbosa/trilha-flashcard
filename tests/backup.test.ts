import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { exportBackup, parseBackupFile, restoreBackup, type BackupPayload } from '../modern/src/data/backup';

type Row = Record<string, any>;

class FakeQueryBuilder {
  private filters: Array<[string, any]> = [];
  private mode: 'select' | 'upsert' = 'select';
  private payloads: Row[] = [];
  private conflictCols: string[] | null = null;

  constructor(private rows: Row[]) {}

  select(_cols?: string) { return this; }
  eq(field: string, value: any) { this.filters.push([field, value]); return this; }
  is(field: string, value: any) { this.filters.push([field, value]); return this; }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert';
    this.payloads = Array.isArray(rows) ? rows : [rows];
    this.conflictCols = opts?.onConflict ? opts.onConflict.split(',') : null;
    return this;
  }

  then(resolve: (value: { data: Row[] | null; error: any }) => void) {
    if (this.mode === 'select') {
      resolve({ data: this.rows.filter((row) => this.filters.every(([f, v]) => row[f] === v)), error: null });
      return;
    }
    for (const payload of this.payloads) {
      const existing = this.conflictCols
        ? this.rows.find((row) => this.conflictCols!.every((c) => row[c] === payload[c]))
        : undefined;
      if (existing) Object.assign(existing, payload);
      else this.rows.push({ ...payload });
    }
    resolve({ data: this.payloads, error: null });
  }
}

class FakeSupabase {
  tables: Record<string, Row[]> = { subjects: [], topics: [], decks: [], cards: [], reviews: [], error_notebook: [] };

  from(table: string) {
    return new FakeQueryBuilder(this.tables[table]);
  }
}

const USER = { id: 'user-1' } as User;
const PROFILE = { id: 'profile-1', name: 'TRT-4 · AJAJ', slug: 'trt4-ajaj' };

describe('parseBackupFile', () => {
  it('aceita um backup válido', () => {
    const payload: BackupPayload = { version: 1, exportedAt: '2026-01-01T00:00:00.000Z', profile: PROFILE, subjects: [], topics: [], decks: [], cards: [], reviews: [], errors: [] };
    expect(parseBackupFile(JSON.stringify(payload)).profile.id).toBe('profile-1');
  });

  it('rejeita um arquivo sem a forma esperada', () => {
    expect(() => parseBackupFile(JSON.stringify({ foo: 'bar' }))).toThrow();
  });

  it('rejeita uma versão não suportada', () => {
    const payload = { version: 2, profile: PROFILE, cards: [] };
    expect(() => parseBackupFile(JSON.stringify(payload))).toThrow();
  });
});

describe('exportBackup + restoreBackup', () => {
  it('exporta e restaura cartões, disciplinas, assuntos e baralhos do mesmo perfil', async () => {
    const db = new FakeSupabase();
    db.tables.subjects.push({ id: 'subj-1', profile_id: PROFILE.id, name: 'Direito X', slug: 'direito-x', weight: 10, priority: null, sort_order: 0 });
    db.tables.decks.push({ id: 'deck-1', profile_id: PROFILE.id, subject_id: 'subj-1', name: 'Baralho X', slug: 'baralho-x' });
    db.tables.cards.push({ id: 'card-1', profile_id: PROFILE.id, deck_id: 'deck-1', subject_id: 'subj-1', front: 'Pergunta', back: 'Resposta', deleted_at: null });

    const payload = await exportBackup(db as unknown as SupabaseClient, PROFILE);
    expect(payload.cards).toHaveLength(1);
    expect(payload.subjects).toHaveLength(1);

    const freshDb = new FakeSupabase();
    const report = await restoreBackup(freshDb as unknown as SupabaseClient, USER, PROFILE.id, payload);
    expect(report.cards).toBe(1);
    expect(freshDb.tables.cards[0].front).toBe('Pergunta');
    expect(freshDb.tables.cards[0].user_id).toBe(USER.id);
  });

  it('recusa restaurar um backup de outro perfil', async () => {
    const db = new FakeSupabase();
    const payload: BackupPayload = { version: 1, exportedAt: '2026-01-01T00:00:00.000Z', profile: { id: 'other-profile', name: 'Outro', slug: 'outro' }, subjects: [], topics: [], decks: [], cards: [], reviews: [], errors: [] };
    await expect(restoreBackup(db as unknown as SupabaseClient, USER, PROFILE.id, payload)).rejects.toThrow();
  });
});
