import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { migrateLegacyLocalData } from '../modern/src/migration/legacy-to-relational';

class FakeStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type Row = Record<string, any>;

function fingerprint(front: string, back: string): string {
  return `${String(front).trim().toLowerCase()}|${String(back).trim().toLowerCase()}`;
}

class FakeQueryBuilder {
  private filters: Array<[string, any]> = [];
  private mode: 'select' | 'insert' | 'upsert' = 'select';
  private payloads: Row[] = [];
  private conflictCols: string[] | null = null;

  constructor(private tables: Record<string, Row[]>, private counters: Record<string, number>, private table: string) {}

  select(_cols?: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push([field, value]);
    return this;
  }

  is(field: string, value: any) {
    this.filters.push([field, value]);
    return this;
  }

  insert(row: Row) {
    this.mode = 'insert';
    this.payloads = [row];
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert';
    this.payloads = Array.isArray(rows) ? rows : [rows];
    this.conflictCols = opts?.onConflict ? opts.onConflict.split(',') : null;
    return this;
  }

  async single() {
    if (this.mode === 'select') {
      const matched = this.rows().filter((row) => this.matches(row));
      if (!matched.length) return { data: null, error: { message: 'not found' } };
      return { data: matched[0], error: null };
    }
    const result = this.runWrite();
    if (result.error) return { data: null, error: result.error };
    return { data: result.data![0], error: null };
  }

  async maybeSingle() {
    const matched = this.rows().filter((row) => this.matches(row));
    return { data: matched[0] ?? null, error: null };
  }

  then(resolve: (value: { data: Row[] | null; error: any }) => void, reject: (reason: unknown) => void) {
    try {
      if (this.mode === 'select') {
        resolve({ data: this.rows().filter((row) => this.matches(row)), error: null });
      } else {
        resolve(this.runWrite());
      }
    } catch (cause) {
      reject(cause);
    }
  }

  private rows() {
    return this.tables[this.table];
  }

  private matches(row: Row) {
    return this.filters.every(([field, value]) => row[field] === value);
  }

  private nextId() {
    this.counters[this.table] = (this.counters[this.table] ?? 0) + 1;
    return `${this.table}-${this.counters[this.table]}`;
  }

  private checkCardFingerprintViolation(payload: Row, self: Row | null): any {
    if (this.table !== 'cards' || payload.deleted_at) return null;
    const clash = this.rows().find((row) =>
      row !== self
      && !row.deleted_at
      && row.user_id === payload.user_id
      && row.profile_id === payload.profile_id
      && fingerprint(row.front, row.back) === fingerprint(payload.front, payload.back));
    if (!clash) return null;
    return { code: '23505', message: 'duplicate key value violates unique constraint "idx_cards_unique_content_active"' };
  }

  private runWrite(): { data: Row[] | null; error: any } {
    const rows = this.rows();
    const written: Row[] = [];
    for (const payload of this.payloads) {
      if (this.mode === 'insert') {
        const violation = this.checkCardFingerprintViolation(payload, null);
        if (violation) return { data: null, error: violation };
        const row = { id: this.nextId(), ...payload };
        rows.push(row);
        written.push(row);
        continue;
      }

      const existing = this.conflictCols
        ? rows.find((row) => this.conflictCols!.every((column) => row[column] === payload[column]))
        : undefined;
      const violation = this.checkCardFingerprintViolation(payload, existing ?? null);
      if (violation) return { data: null, error: violation };
      if (existing) {
        Object.assign(existing, payload);
        written.push(existing);
      } else {
        const row = { id: this.nextId(), ...payload };
        rows.push(row);
        written.push(row);
      }
    }
    return { data: written, error: null };
  }
}

class FakeSupabase {
  tables: Record<string, Row[]> = { study_profiles: [], subjects: [], topics: [], decks: [], cards: [] };
  private counters: Record<string, number> = {};

  from(table: string) {
    return new FakeQueryBuilder(this.tables, this.counters, table);
  }
}

const USER = { id: 'user-1' } as User;

describe('migração de cartões legados para o modelo relacional', () => {
  it('não trava a migração quando dois baralhos diferentes têm um cartão com o mesmo conteúdo', async () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-flashcard-deck:deckA', JSON.stringify([{ id: 'c1', front: 'Pergunta X', back: 'Resposta X' }]));
    storage.setItem('trilha-flashcard-deck:deckB', JSON.stringify([{ id: 'c2', front: 'Pergunta X', back: 'Resposta X' }]));

    const db = new FakeSupabase();
    const report = await migrateLegacyLocalData(db as unknown as SupabaseClient, USER, storage);

    expect(report.cards).toBe(1);
    expect(report.skippedCards).toBe(1);
    expect(db.tables.cards).toHaveLength(1);
  });

  it('reexecutar a migração atualiza os cartões existentes em vez de duplicar ou travar', async () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-flashcard-deck:deckA', JSON.stringify([{ id: 'c1', front: 'Pergunta X', back: 'Resposta X' }]));
    storage.setItem('trilha-flashcard-deck:deckB', JSON.stringify([{ id: 'c2', front: 'Pergunta X', back: 'Resposta X' }]));

    const db = new FakeSupabase();
    await migrateLegacyLocalData(db as unknown as SupabaseClient, USER, storage);
    const secondReport = await migrateLegacyLocalData(db as unknown as SupabaseClient, USER, storage);

    expect(secondReport.cards).toBe(1);
    expect(secondReport.skippedCards).toBe(1);
    expect(db.tables.cards).toHaveLength(1);
  });

  it('migra normalmente cartões com conteúdo distinto entre baralhos', async () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-flashcard-deck:deckA', JSON.stringify([{ id: 'c1', front: 'Pergunta X', back: 'Resposta X' }]));
    storage.setItem('trilha-flashcard-deck:deckB', JSON.stringify([{ id: 'c2', front: 'Pergunta Y', back: 'Resposta Y' }]));

    const db = new FakeSupabase();
    const report = await migrateLegacyLocalData(db as unknown as SupabaseClient, USER, storage);

    expect(report.cards).toBe(2);
    expect(report.skippedCards).toBe(0);
    expect(db.tables.cards).toHaveLength(2);
  });
});
