import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listLegalProvisions } from '../src/features/legal-provisions/legal-provisions-repository';

class FakeQueryBuilder {
  private filters: Array<[string, any]> = [];
  private orderField: string | null = null;

  constructor(private rows: any[]) {}

  select(_cols?: string) { return this; }
  eq(field: string, value: any) { this.filters.push([field, value]); return this; }
  order(field: string) { this.orderField = field; return this; }
  limit(_n: number) { return this; }

  then(resolve: (value: { data: any[] | null; error: any }) => void) {
    let rows = this.rows.filter((row) => this.filters.every(([f, v]) => row[f] === v));
    if (this.orderField) rows = [...rows].sort((a, b) => a[this.orderField!] - b[this.orderField!]);
    resolve({ data: rows, error: null });
  }
}

class FakeSupabase {
  tables: Record<string, any[]> = { legal_provisions: [] };
  from(table: string) { return new FakeQueryBuilder(this.tables[table]); }
}

describe('listLegalProvisions', () => {
  it('retorna as normas do perfil ordenadas por sort_order', async () => {
    const db = new FakeSupabase();
    db.tables.legal_provisions.push(
      { id: 'lp-2', profile_id: 'profile-1', subject_id: null, topic_id: null, law_name: 'CPC - base', articles: 'arts. 1º-15', focus: 'Normas', notes: null, tags: [], sort_order: 6 },
      { id: 'lp-1', profile_id: 'profile-1', subject_id: 'subj-1', topic_id: null, law_name: 'CF/88', articles: 'arts. 5º; 7º-11', focus: 'Direitos', notes: null, tags: ['Constitucional'], sort_order: 0 },
      { id: 'lp-other', profile_id: 'profile-2', subject_id: null, topic_id: null, law_name: 'Fora do perfil', articles: '-', focus: null, notes: null, tags: [], sort_order: 0 },
    );

    const rows = await listLegalProvisions(db as unknown as SupabaseClient, 'profile-1');
    expect(rows).toHaveLength(2);
    expect(rows[0].law_name).toBe('CF/88');
    expect(rows[1].law_name).toBe('CPC - base');
  });
});
