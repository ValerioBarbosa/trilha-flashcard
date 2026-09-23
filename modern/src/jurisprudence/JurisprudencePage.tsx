import { useEffect, useState } from 'react';
import { listJurisprudence } from '@core/features/jurisprudence/jurisprudence-repository';
import type { JurisprudenceRow } from '@core/features/study/domain-repository';
import { listCardsByType, type CardRow } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { EmptyFeature } from '../shared/EmptyFeature';
import { PageHeader } from '../shared/PageHeader';

export function JurisprudencePage({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<JurisprudenceRow[]>([]);
  const [query, setQuery] = useState('');
  const [catalogCards, setCatalogCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const client = getSupabaseClient();
    return Promise.all([
      listJurisprudence(client, profileId),
      listCardsByType(client, profileId, 'Jurisprudência'),
      listCardsByType(client, profileId, 'Revisão jurisprudencial'),
    ])
      .then(([jurisprudence, primaryCards, reviewCards]) => {
        setRows(jurisprudence);
        setCatalogCards([...primaryCards, ...reviewCards]);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a jurisprudência.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, [profileId]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = rows.filter((row) => `${row.court} ${row.theme || ''} ${row.thesis} ${row.summary || ''}`.toLowerCase().includes(normalizedQuery));
  const filteredCatalogCards = catalogCards.filter((card) => `${card.front} ${card.back} ${card.legal_basis || ''}`.toLowerCase().includes(normalizedQuery));

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="JURISPRUDÊNCIA VIVA" title="Jurisprudência" subtitle="Teses ligadas ao edital, com foco de cobrança e status de atualização." action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tese ou tribunal" /></div>} />
      {error ? <div className="notice error"><strong>Falha ao carregar jurisprudência.</strong><span>{error}</span><button onClick={() => void load()}>Tentar novamente</button></div> : null}
      {loading ? <div className="study-empty">Carregando jurisprudência…</div> : !error && !filtered.length && !filteredCatalogCards.length ? (
        <EmptyFeature title="Nenhuma jurisprudência encontrada." text="O catálogo está pronto para receber teses vinculadas ao edital." />
      ) : !error ? (
        <>
          {filtered.length ? <div className="juris-grid">
            {filtered.map((row) => <article key={row.id} className="juris-card"><div className="juris-meta"><span>{row.court}</span><span className={`status status-${row.status}`}>{row.status}</span></div><h2>{row.theme || 'Tese jurisprudencial'}</h2><p>{row.summary || row.thesis}</p><details><summary>Ver tese completa</summary><blockquote>{row.thesis}</blockquote>{row.exam_angle ? <p><strong>Como pode cair:</strong> {row.exam_angle}</p> : null}{row.pitfall ? <p><strong>Pegadinha:</strong> {row.pitfall}</p> : null}{row.legal_basis ? <small>Base legal: {row.legal_basis}</small> : null}</details></article>)}
          </div> : null}
          {filteredCatalogCards.length ? <section className="panel-card"><span className="panel-label">MAPA PRIORITÁRIO DO CATÁLOGO</span><div className="juris-grid">
            {filteredCatalogCards.map((card) => <article key={card.id} className="juris-card"><div className="juris-meta"><span>{card.card_type}</span><span className="status">TRT-4</span></div><h2>{card.legal_basis || 'Jurisprudência prioritária'}</h2><p>{card.back}</p><details><summary>Ver orientação de estudo</summary><blockquote>{card.front}</blockquote>{card.pitfall ? <p><strong>Pegadinha:</strong> {card.pitfall}</p> : null}{card.complement ? <p>{card.complement}</p> : null}</details></article>)}
          </div></section> : null}
        </>
      ) : null}
    </div>
  );
}
