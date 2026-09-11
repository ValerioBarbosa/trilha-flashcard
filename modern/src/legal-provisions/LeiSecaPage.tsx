import { useEffect, useState } from 'react';
import { listLegalProvisions } from '@core/features/legal-provisions/legal-provisions-repository';
import type { LegalProvisionRow } from '@core/features/legal-provisions/legal-provisions-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { EmptyFeature } from '../shared/EmptyFeature';
import { PageHeader } from '../shared/PageHeader';

export function LeiSecaPage({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<LegalProvisionRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void listLegalProvisions(getSupabaseClient(), profileId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [profileId]);

  const filtered = rows.filter((row) => `${row.law_name} ${row.articles} ${row.focus || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="CADERNO DE ARTIGOS CRÍTICOS" title="Lei Seca" subtitle="Normas e artigos críticos do edital, por bloco de estudo." action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar norma ou artigo" /></div>} />
      {loading ? <div className="study-empty">Carregando lei seca…</div> : !filtered.length ? (
        <EmptyFeature title="Caderno de lei seca pronto." text="Quando normas forem cadastradas, elas aparecerão aqui com os artigos críticos e o foco de cada bloco." />
      ) : (
        <div className="juris-grid">
          {filtered.map((row) => <article key={row.id} className="juris-card"><div className="juris-meta"><span>{row.law_name}</span></div><h2>{row.articles}</h2>{row.focus ? <p>{row.focus}</p> : null}{row.notes ? <details><summary>Ver anotações</summary><blockquote>{row.notes}</blockquote></details> : null}</article>)}
        </div>
      )}
    </div>
  );
}
