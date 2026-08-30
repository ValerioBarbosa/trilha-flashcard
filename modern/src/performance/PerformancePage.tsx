import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { MetricTile } from '../shared/MetricTile';
import { PageHeader } from '../shared/PageHeader';

export function PerformancePage({ user, profileId }: { user: User; profileId: string }) {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void loadPerformance(getSupabaseClient(), user, profileId)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [user.id, profileId]);

  if (loading) return <div className="page-wrap"><PageHeader eyebrow="ANÁLISE" title="Desempenho" /><div className="study-empty">Calculando desempenho…</div></div>;

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="ANÁLISE" title="Desempenho" subtitle="Métricas reais das revisões e questões gravadas no Supabase." />
      <div className="dashboard-grid four">
        <MetricTile label="Revisões" value={summary?.totalReviews ?? 0} helper={`${summary?.reviewedToday ?? 0} hoje`} />
        <MetricTile label="Acerto nos cartões" value={`${summary?.accuracy ?? 0}%`} helper={`${summary?.correctReviews ?? 0} respostas boas/fáceis`} />
        <MetricTile label="Questões" value={summary?.attemptedQuestions ?? 0} helper={`${summary?.questionAccuracy ?? 0}% de acerto`} />
        <MetricTile label="Caderno de erros" value={summary?.openErrors ?? 0} helper="pendências abertas" />
      </div>
      <div className="content-grid two-one">
        <section className="panel-card"><span className="panel-label">LEITURA DO MOMENTO</span><h2>{(summary?.accuracy ?? 0) >= 80 ? 'Consistência forte.' : (summary?.totalReviews ?? 0) === 0 ? 'Comece a registrar revisões.' : 'Há espaço claro para ganho.'}</h2><p>{(summary?.totalReviews ?? 0) === 0 ? 'Faça uma sessão de cartões para iniciar sua série histórica.' : `Sua taxa atual nos cartões é ${summary?.accuracy ?? 0}%. O próximo ganho vem de revisar os itens difíceis e cruzá-los com questões.`}</p></section>
        <section className="panel-card accent-panel"><span className="panel-label">PRÓXIMO FOCO</span><h2>Erros primeiro.</h2><p>O caderno de erros será o ponto de encontro entre cartões, questões e jurisprudência.</p></section>
      </div>
    </div>
  );
}
