import { useEffect, useState } from 'react';
import { listJurisprudence } from '@core/features/jurisprudence/jurisprudence-repository';
import type { JurisprudenceRow } from '@core/features/study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { EmptyFeature } from '../shared/EmptyFeature';
import { PageHeader } from '../shared/PageHeader';

export function JurisprudencePage({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<JurisprudenceRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void listJurisprudence(getSupabaseClient(), profileId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [profileId]);

  const filtered = rows.filter((row) => `${row.court} ${row.theme || ''} ${row.thesis} ${row.summary || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="JURISPRUDÊNCIA VIVA" title="Jurisprudência" subtitle="Teses ligadas ao edital, com foco de cobrança e status de atualização." action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tese ou tribunal" /></div>} />
      {loading ? <div className="study-empty">Carregando jurisprudência…</div> : !filtered.length ? (
        <EmptyFeature title="Área de jurisprudência pronta." text="Quando teses forem cadastradas, elas aparecerão aqui vinculadas à disciplina, tema, base legal e forma provável de cobrança." />
      ) : (
        <div className="juris-grid">
          {filtered.map((row) => <article key={row.id} className="juris-card"><div className="juris-meta"><span>{row.court}</span><span className={`status status-${row.status}`}>{row.status}</span></div><h2>{row.theme || 'Tese jurisprudencial'}</h2><p>{row.summary || row.thesis}</p><details><summary>Ver tese completa</summary><blockquote>{row.thesis}</blockquote>{row.exam_angle ? <p><strong>Como pode cair:</strong> {row.exam_angle}</p> : null}{row.pitfall ? <p><strong>Pegadinha:</strong> {row.pitfall}</p> : null}{row.legal_basis ? <small>Base legal: {row.legal_basis}</small> : null}</details></article>)}
        </div>
      )}
    </div>
  );
}
