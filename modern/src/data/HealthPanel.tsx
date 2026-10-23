import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { OFFICIAL_TOPIC_COUNT } from '../edital/official-edital-2026';
import { getSupabaseClient } from '../lib/supabase-client';
import { seedBuiltinStudyCatalog } from '../study/builtin-seed';
import { listOfficialEditalTopicIds } from '../study/domain-repository';
import { offlineWorkspaceAge } from '../study/offline-cache';

const EXPECTED_CATALOG = 1575;

type Health = {
  online: boolean;
  catalog: number;
  topics: number;
  checkedAt: string;
  cacheAt: string | null;
  error: string | null;
};

export function HealthPanel({ user, profileId, onRepaired }: { user: User; profileId: string; onRepaired?: () => void | Promise<void> }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    const client = getSupabaseClient();
    try {
      const [{ count, error }, topicIds] = await Promise.all([
        client.from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profileId)
          .is('deleted_at', null)
          .eq('suspended', false)
          .like('source', 'Edital nº 1/2026 TRT-4 AJAJ%'),
        listOfficialEditalTopicIds(client, profileId),
      ]);
      if (error) throw error;
      setHealth({
        online: true,
        catalog: count ?? 0,
        topics: topicIds.size,
        checkedAt: new Date().toISOString(),
        cacheAt: offlineWorkspaceAge(user.id),
        error: null,
      });
    } catch (cause) {
      setHealth({
        online: false,
        catalog: 0,
        topics: 0,
        checkedAt: new Date().toISOString(),
        cacheAt: offlineWorkspaceAge(user.id),
        error: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  }

  async function repair() {
    setBusy(true);
    const client = getSupabaseClient();
    try {
      await seedBuiltinStudyCatalog(client, user, profileId);
      await check();
      await onRepaired?.();
    } catch (cause) {
      setHealth((current) => ({
        online: false,
        catalog: current?.catalog ?? 0,
        topics: current?.topics ?? 0,
        checkedAt: new Date().toISOString(),
        cacheAt: offlineWorkspaceAge(user.id),
        error: cause instanceof Error ? cause.message : String(cause),
      }));
      setBusy(false);
    }
  }

  useEffect(() => { void check(); }, [profileId]);

  const catalogOk = (health?.catalog ?? 0) >= EXPECTED_CATALOG;
  const topicsOk = (health?.topics ?? 0) >= OFFICIAL_TOPIC_COUNT;
  const healthy = Boolean(health?.online && catalogOk && topicsOk);

  return <section className="health-panel">
    <div className="section-heading">
      <div>
        <span className="page-eyebrow">SAÚDE DO TRILHA</span>
        <h2>{healthy ? 'Tudo certo para estudar' : 'Diagnóstico do aplicativo'}</h2>
        <p>Confere conexão, catálogo oficial, matriz do edital e a última cópia offline deste dispositivo.</p>
      </div>
      <span className={`health-badge ${healthy ? 'ok' : health?.online ? 'warn' : 'bad'}`}>{healthy ? 'Saudável' : health?.online ? 'Atenção' : 'Offline'}</span>
    </div>

    <div className="health-grid">
      <div><span>Supabase</span><strong>{health?.online ? 'Online' : 'Indisponível'}</strong><small>{health?.online ? 'Banco respondendo' : 'Estudo offline disponível se houver cache'}</small></div>
      <div><span>Catálogo oficial</span><strong>{health ? `${health.catalog}/${EXPECTED_CATALOG}` : '—'}</strong><small>{catalogOk ? 'Completo' : 'Precisa de reparo'}</small></div>
      <div><span>Matriz do edital</span><strong>{health ? `${Math.min(health.topics, OFFICIAL_TOPIC_COUNT)}/${OFFICIAL_TOPIC_COUNT}` : '—'}</strong><small>{topicsOk ? 'Tópicos vinculados' : 'Vínculos incompletos'}</small></div>
      <div><span>Cache offline</span><strong>{health?.cacheAt ? 'Disponível' : 'Ainda não'}</strong><small>{health?.cacheAt ? new Date(health.cacheAt).toLocaleString('pt-BR') : 'Abra o Trilha online ao menos uma vez'}</small></div>
    </div>

    {health?.error ? <div className="notice error"><strong>Diagnóstico</strong><span>{health.error}</span></div> : null}

    <div className="health-actions">
      <button className="secondary-outline" disabled={busy} onClick={() => void check()}>{busy ? 'Verificando…' : 'Verificar novamente'}</button>
      <button className="primary-action" disabled={busy || !health?.online} onClick={() => void repair()}>Reparar catálogo</button>
    </div>
    <small className="health-note">O reparo reutiliza cartões existentes sempre que possível e não apaga seu histórico de revisões.</small>
  </section>;
}
