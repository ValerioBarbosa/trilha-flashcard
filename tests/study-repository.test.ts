import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createStudyProfile, ensureDefaultProfile } from '../src/features/study/study-repository';

type Row = Record<string, any>;

class FakeQueryBuilder {
  private filters: Array<[string, any]> = [];
  private mode: 'select' | 'insert' = 'select';
  private payload: Row | null = null;

  constructor(private rows: Row[], private counters: Record<string, number>, private table: string) {}

  select(_cols?: string) { return this; }
  eq(field: string, value: any) { this.filters.push([field, value]); return this; }

  insert(row: Row) { this.mode = 'insert'; this.payload = row; return this; }

  async maybeSingle() {
    const matched = this.rows.filter((row) => this.matches(row));
    return { data: matched[0] ?? null, error: null };
  }

  async single() {
    if (this.mode === 'select') {
      const matched = this.rows.filter((row) => this.matches(row));
      if (!matched.length) return { data: null, error: { message: 'not found' } };
      return { data: matched[0], error: null };
    }
    this.counters[this.table] = (this.counters[this.table] ?? 0) + 1;
    const row = { id: `${this.table}-${this.counters[this.table]}`, ...this.payload };
    this.rows.push(row);
    return { data: row, error: null };
  }

  private matches(row: Row) {
    return this.filters.every(([field, value]) => row[field] === value);
  }
}

class FakeSupabase {
  tables: Record<string, Row[]> = { study_profiles: [] };
  private counters: Record<string, number> = {};

  from(table: string) {
    return new FakeQueryBuilder(this.tables[table], this.counters, table);
  }
}

const USER = { id: 'user-1' } as User;

describe('ensureDefaultProfile', () => {
  it('cria o perfil padrão na primeira chamada e reaproveita nas seguintes', async () => {
    const db = new FakeSupabase();
    const first = await ensureDefaultProfile(db as unknown as SupabaseClient, USER);
    expect(first.slug).toBe('trt4-ajaj');
    expect(first.is_builtin).toBe(true);

    const second = await ensureDefaultProfile(db as unknown as SupabaseClient, USER);
    expect(second.id).toBe(first.id);
    expect(db.tables.study_profiles).toHaveLength(1);
  });
});

describe('createStudyProfile', () => {
  it('cria um perfil novo, não-builtin, com slug derivado do nome', async () => {
    const db = new FakeSupabase();
    const profile = await createStudyProfile(db as unknown as SupabaseClient, USER, { name: 'TJ-SP · Escrevente' });
    expect(profile.slug).toBe('tj-sp-escrevente');
    expect(profile.is_builtin).toBe(false);
  });

  it('evita colisão de slug quando já existe um perfil com o mesmo nome', async () => {
    const db = new FakeSupabase();
    const first = await createStudyProfile(db as unknown as SupabaseClient, USER, { name: 'Concurso X' });
    const second = await createStudyProfile(db as unknown as SupabaseClient, USER, { name: 'Concurso X' });
    expect(first.slug).not.toBe(second.slug);
    expect(second.slug.startsWith('concurso-x')).toBe(true);
  });

  it('rejeita nome vazio', async () => {
    const db = new FakeSupabase();
    await expect(createStudyProfile(db as unknown as SupabaseClient, USER, { name: '  ' })).rejects.toThrow();
  });
});
