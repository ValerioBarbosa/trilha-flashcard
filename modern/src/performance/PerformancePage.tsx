import { loadQuestionAccuracy } from '../learning/practice-repository';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
import type { SubjectRow } from '@core/features/study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { MetricTile } from '../shared/MetricTile';
import { PageHeader } from '../shared/PageHeader';

type Props = {
  user: User;
  profileId: string;
  subjects: SubjectRow[];
  onReviewWrong: () => void;
  onReviewDue: () => void;
};

export function PerformancePage({ user, profileId, subjects, onReviewWrong, onReviewDue }: Props) {
  const [questionScore, setQuestionScore] = useState<{total:number;correct:number;accuracy:number|null} | null>(null);
  const [questionError, setQuestionError] = useState('');
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    setQuestionError('');
    void loadQuestionAccuracy(getSupabaseClient(), user, profileId).then(setQuestionScore).catch(() => setQuestionError('Não foi possível carregar os resultados de questões.'));
    return loadPerformance(getSupabaseClient(), user, profileId)
      .then(setSummary)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível calcular o desempenho.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, [user.id, profileId]);

  if (loading) return <div className="page-wrap"><PageHeader eyebrow="ANÁLISE" title="Desempenho" /><div className="study-empty">Calculando desempenho…</div></div>;
  if (error) return <div className="page-wrap"><PageHeader eyebrow="ANÁLISE" title="Desempenho" /><div className="notice error"><strong>Falha ao calcular desempenho.</strong><span>{error}</span><button onClick={() => void load()}>Tentar novamente</button></div></div>;

  const subjectName = (subjectId: string) => subjects.find((subject) => subject.id === subjectId)?.name || 'Sem disciplina';
  const bySubject = [...(summary?.bySubject ?? [])].sort((a, b) => a.accuracy - b.accuracy || b.reviews - a.reviews);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="ANÁLISE" title="Desempenho" subtitle="Acertos de questões separados da autoavaliação dos cartões. Não são previsão de nota da FCC." />
      {questionError ? <div className="notice error">{questionError}</div> : null}
      <div className="dashboard-grid lei-seca-metrics">
        <MetricTile label="Acertos em questões" value={questionScore?.accuracy == null ? "—" : `${questionScore.accuracy}%`} helper={`${questionScore?.correct ?? 0}/${questionScore?.total ?? 0} tentativas com gabarito; inclui repetições`} />
        <MetricTile label="Sequência" value={`${summary?.streakDays ?? 0} dia${summary?.streakDays === 1 ? '' : 's'}`} helper="de estudo seguido" />
        <MetricTile label="Revisões" value={summary?.totalReviews ?? 0} helper={`${summary?.reviewedToday ?? 0} hoje`} />
        <MetricTile label="Recuperação declarada" value={`${summary?.accuracy ?? 0}%`} helper={`${summary?.correctReviews ?? 0} autoavaliações boas/fáceis`} />
        <MetricTile label="Revisar hoje" value={summary?.dueNow ?? 0} helper="cartões vencidos para revisão" />
        <MetricTile label="Caderno de erros" value={summary?.openErrors ?? 0} helper="pendências abertas" />
      </div>

      <div className="review-actions-row">
        <button className="primary-action" disabled={!summary?.dueNow} onClick={onReviewDue}>
          {summary?.dueNow ? `Revisar ${summary.dueNow} cartão${summary.dueNow === 1 ? '' : 'ões'} vencido${summary.dueNow === 1 ? '' : 's'}` : 'Nenhuma revisão vencida'}
        </button>
        <button className="secondary-outline" disabled={!summary?.openErrors} onClick={onReviewWrong}>
          {summary?.openErrors ? `Revisar ${summary.openErrors} errado${summary.openErrors === 1 ? '' : 's'}` : 'Nenhum erro pendente'}
        </button>
      </div>

      <section className="panel-card">
        <span className="panel-label">AUTOAVALIAÇÃO DOS CARTÕES POR DISCIPLINA</span>
        {bySubject.length ? (
          <div className="subject-performance-list">
            {bySubject.map((entry) => (
              <div key={entry.subjectId} className="subject-performance-row">
                <div><strong>{subjectName(entry.subjectId)}</strong><small>{entry.reviews} revisão{entry.reviews === 1 ? '' : 'ões'}</small></div>
                <div className="subject-performance-track" aria-hidden="true"><span style={{ width: `${entry.accuracy}%` }} /></div>
                <strong>{entry.accuracy}%</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>Ainda não há revisões suficientes para quebrar por disciplina.</p>
        )}
      </section>
    </div>
  );
}
