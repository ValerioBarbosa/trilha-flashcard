import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { ensureDefaultProfile, loadStudyMetrics, type StudyMetrics, type StudyProfile } from './study-repository';

type Props = { user: User; refreshSignal?: number };

type State = {
  loading: boolean;
  error: string | null;
  profile: StudyProfile | null;
  metrics: StudyMetrics | null;
};

const EMPTY: State = { loading: true, error: null, profile: null, metrics: null };

export function StudyDashboard({ user, refreshSignal = 0 }: Props) {
  const [state, setState] = useState<State>(EMPTY);

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const client = getSupabaseClient();
      const profile = await ensureDefaultProfile(client, user);
      const metrics = await loadStudyMetrics(client, user);
      setState({ loading: false, error: null, profile, metrics });
    } catch (cause) {
      setState((current) => ({
        ...current,
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      }));
    }
  }

  useEffect(() => {
    void refresh();
  }, [user.id, refreshSignal]);

  return (
    <section className="study-dashboard" aria-labelledby="study-dashboard-title">
      <div className="section-heading">
        <div>
          <h2 id="study-dashboard-title">Base de estudos</h2>
          <p>Leitura real do novo modelo relacional no Supabase.</p>
        </div>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={state.loading}>
          {state.loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {state.error ? <p className="pilot-error" role="alert">{state.error}</p> : null}

      {state.profile ? (
        <div className="profile-strip">
          <strong>{state.profile.name}</strong>
          <span>{[state.profile.role, state.profile.board, state.profile.edital_year].filter(Boolean).join(' · ')}</span>
        </div>
      ) : null}

      {state.metrics ? (
        <div className="metric-cards" aria-label="Indicadores do banco normalizado">
          <Metric label="Perfis" value={state.metrics.profiles} />
          <Metric label="Disciplinas" value={state.metrics.subjects} />
          <Metric label="Tópicos" value={state.metrics.topics} />
          <Metric label="Baralhos" value={state.metrics.decks} />
          <Metric label="Cartões" value={state.metrics.cards} />
          <Metric label="Revisões" value={state.metrics.reviews} />
          <Metric label="Questões" value={state.metrics.questions} />
          <Metric label="Tentativas" value={state.metrics.attempts} />
          <Metric label="Jurisprudência" value={state.metrics.jurisprudence} />
          <Metric label="Erros abertos" value={state.metrics.openErrors} />
        </div>
      ) : state.loading ? (
        <p className="pilot-note">Carregando estrutura de estudos…</p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
