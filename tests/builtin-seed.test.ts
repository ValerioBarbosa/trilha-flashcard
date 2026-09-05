import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { seedBuiltinStudyCatalog } from '../modern/src/study/builtin-seed';

type Row = Record<string, any>;

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

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert';
    this.payloads = Array.isArray(rows) ? rows : [rows];
    this.conflictCols = opts?.onConflict ? opts.onConflict.split(',') : null;
    return this;
  }

  async single() {
    const result = this.runWrite();
    if (result.error) return { data: null, error: result.error };
    return { data: result.data![0], error: null };
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

  private runWrite(): { data: Row[] | null; error: any } {
    const rows = this.rows();
    const written: Row[] = [];
    for (const payload of this.payloads) {
      const existing = this.conflictCols
        ? rows.find((row) => this.conflictCols!.every((column) => row[column] === payload[column]))
        : undefined;
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
  tables: Record<string, Row[]> = { subjects: [], topics: [], decks: [], cards: [] };
  private counters: Record<string, number> = {};

  from(table: string) {
    return new FakeQueryBuilder(this.tables, this.counters, table);
  }
}

const USER = { id: 'user-1' } as User;

describe('seedBuiltinStudyCatalog contra o catálogo real do edital verticalizado', () => {
  it('não cria disciplina para baralhos sem nenhum assunto e sem nenhum cartão', async () => {
    const db = new FakeSupabase();
    const report = await seedBuiltinStudyCatalog(db as unknown as SupabaseClient, USER, 'profile-1');

    const ghostSubject = db.tables.subjects.find((row) => row.name === 'Justiça do Trabalho');
    expect(ghostSubject).toBeUndefined();
    expect(report.decks).toBeLessThan(12);
  });

  it('grava o peso do edital verticalizado embutido no título do baralho em subjects.weight', async () => {
    const db = new FakeSupabase();
    await seedBuiltinStudyCatalog(db as unknown as SupabaseClient, USER, 'profile-1');

    const laborProcedure = db.tables.subjects.find((row) => row.name === 'Direito Processual do Trabalho');
    expect(laborProcedure?.weight).toBe(17.8);

    const portuguese = db.tables.subjects.find((row) => row.name === 'Português');
    expect(portuguese?.weight).toBe(16.7);

    const lgpd = db.tables.subjects.find((row) => row.name === 'LGPD / Direito Digital');
    expect(lgpd?.weight).toBe(2.2);
  });

  it('mantém sem peso as disciplinas fora da tabela ponderada do edital (onboarding e Estudo de Caso)', async () => {
    const db = new FakeSupabase();
    await seedBuiltinStudyCatalog(db as unknown as SupabaseClient, USER, 'profile-1');

    const writing = db.tables.subjects.find((row) => row.name === 'Estudo de Caso Jurídico');
    expect(writing?.weight ?? null).toBeNull();
    expect(db.tables.subjects.some((row) => row.name.startsWith('Comece aqui'))).toBe(false);
  });
});
