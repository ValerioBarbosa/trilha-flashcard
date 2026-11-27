import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { OFFICIAL_EDITAL_2026, OFFICIAL_TOPIC_COUNT } from '../edital/official-edital-2026';
import { getSupabaseClient } from '../lib/supabase-client';
import { seedBuiltinStudyCatalog } from '../study/builtin-seed';
import { listSubjects, listTopics, listDecks } from '../study/domain-repository';
import { applySafeTopicMappings, buildCatalogAudit, listAuditCards, type CatalogAudit } from '../study/catalog-audit';
import { offlineWorkspaceAge } from '../study/offline-cache';
import { EXPECTED_BUILTIN_CATALOG_CARDS } from '../study/useStudyWorkspace';
import { automaticBackupAt } from './auto-backup';

const EXPECTED_CATALOG = EXPECTED_BUILTIN_CATALOG_CARDS;

type Health = {
  online: boolean;
  catalog: number;
  topics: number;
  covered: number;
  checkedAt: string;
  cacheAt: string | null;
  error: string | null;
};

export function HealthPanel({ user, profileId, isBuiltin = true, onRepaired }: { user: User; profileId: string; isBuiltin?: boolean; onRepaired?: () => void | Promise<void> }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<CatalogAudit | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    const client = getSupabaseClient();
    try {
      const [subjects, topics, decks, cards] = await Promise.all([
        listSubjects(client, profileId),
        listTopics(client, profileId),
        listDecks(client, profileId),
        listAuditCards(client, profileId),
      ]);
      const report = buildCatalogAudit(subjects, topics, decks, cards);
      setAudit(report);
      setFeedback(null);
      setHealth({
        online: true,
        catalog: report.v4Cards,
        topics: report.registeredTopics,
        covered: report.coveredTopics,
        checkedAt: new Date().toISOString(),
        cacheAt: offlineWorkspaceAge(user.id),
        error: null,
      });
    } catch (cause) {
      setAudit(null);
      setHealth({
        online: false,
        catalog: 0,
        topics: 0,
        covered: 0,
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
        covered: current?.covered ?? 0,
        checkedAt: new Date().toISOString(),
        cacheAt: offlineWorkspaceAge(user.id),
        error: cause instanceof Error ? cause.message : String(cause),
      }));
      setBusy(false);
    }
  }

  async function applyMappings() {
    if (!audit?.safeMappings.length || !isBuiltin || !health?.online) return;
    const cardTotal = audit.safeMappings.reduce((sum, mapping) => sum + mapping.cardIds.length, 0);
    if (!window.confirm(`Reassociar ${cardTotal} cartões antigos a ${audit.safeMappings.length} recortes V4? Apenas vínculos inequívocos serão modificados. As revisões e os IDs dos cartões serão preservados.`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await applySafeTopicMappings(getSupabaseClient(), profileId, audit.safeMappings);
      await check();
      setFeedback(`${result.changed} cartões vinculados à matriz V4; ${result.groups} grupos verificados. Nenhuma revisão foi apagada.`);
      await onRepaired?.();
    } catch (cause) {
      setFeedback(`Falha no remapeamento: ${cause instanceof Error ? cause.message : String(cause)}. Execute uma nova auditoria para identificar os itens restantes.`);
      setBusy(false);
    }
  }

  useEffect(() => { void check(); }, [profileId]);

  const catalogOk = (health?.catalog ?? 0) >= EXPECTED_CATALOG;
  const topicsOk = (health?.topics ?? 0) >= OFFICIAL_TOPIC_COUNT;
  const healthy = Boolean(health?.online && (!isBuiltin || (topicsOk && audit?.outsideOfficialMatrix === 0 && audit?.withoutTopic === 0)));
  const safeCardCount = audit?.safeMappings.reduce((sum, entry) => sum + entry.cardIds.length, 0) || 0;

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
      <div><span>Novos cartões V4</span><strong>{health ? `${health.catalog}/${EXPECTED_CATALOG}` : '—'}</strong><small>{catalogOk ? 'Complemento carregado' : 'Verificar sincronização'}</small></div>
      <div><span>Matriz do edital</span><strong>{health ? `${health.topics}/${OFFICIAL_TOPIC_COUNT}` : '—'}</strong><small>{topicsOk ? `${health?.covered ?? 0} recortes com flashcards` : 'Matriz incompleta'}</small></div>
      <div><span>Cache offline</span><strong>{health?.cacheAt ? 'Disponível' : 'Ainda não'}</strong><small>{health?.cacheAt ? new Date(health.cacheAt).toLocaleString('pt-BR') : 'Abra o Trilha online ao menos uma vez'}</small></div>
      <div><span>Backup automático</span><strong>{automaticBackupAt(profileId) ? 'Protegido' : 'Pendente'}</strong><small>{automaticBackupAt(profileId) ? new Date(automaticBackupAt(profileId)!).toLocaleString('pt-BR') : 'Será criado quando o banco estiver online'}</small></div>
    </div>

    {health?.error ? <div className="notice error"><strong>Diagnóstico</strong><span>{health.error}</span></div> : null}
    {isBuiltin && audit ? <section className="catalog-audit">
      <h3>Auditoria do edital V4</h3>
      <p>Os 285 recortes são a matriz didática. A cobertura conta somente cartões de conteúdo ativos e vinculados, não roteiros nem Lei Seca.</p>
      <div className="catalog-audit-grid">
        <div><strong>{audit.coveredTopics}/{audit.expectedTopics}</strong><span>Recortes com conteúdo</span></div>
        <div><strong>{audit.outsideOfficialMatrix}</strong><span>Cartões em tópicos legados</span></div>
        <div><strong>{audit.withoutTopic}</strong><span>Cartões sem assunto</span></div>
        <div><strong>{audit.potentialDuplicates}</strong><span>Possíveis duplicidades de texto</span></div>
        <div><strong>{audit.missingTopics.length}</strong><span>Recortes ainda não cadastrados</span></div>
        <div><strong>{audit.requiresHumanReview}</strong><span>Vínculos que exigem revisão manual</span></div>
      </div>
      <p><strong>Base legal:</strong> {audit.missingLegalBasis} cartões de estudo sem referência cadastrada. Isso indica uma pendência editorial, não comprova que a legislação esteja desatualizada.</p>
      {audit.safeMappings.length ? <>
        <p><strong>Remapeamento seguro:</strong> {safeCardCount} cartões antigos em {audit.safeMappings.length} assuntos podem ser associados à V4 por correspondência inequívoca de título.</p>
        <details className="catalog-audit-details"><summary>Conferir vínculos propostos</summary>
          <ul>{audit.safeMappings.slice(0, 30).map((mapping) => <li key={mapping.fromId}><strong>{mapping.fromName}</strong> → {mapping.toName} ({mapping.cardIds.length} cartões; {mapping.match})</li>)}</ul>
          {audit.safeMappings.length > 30 ? <small>Mostrando 30 dos {audit.safeMappings.length} grupos. A operação aplica somente os vínculos auditados.</small> : null}
        </details>
        <button className="primary-action" disabled={busy || !health?.online} onClick={() => void applyMappings()}>Aplicar somente vínculos seguros ({safeCardCount})</button>
      </> : <p>Nenhum vínculo automático inequívoco pendente. Os demais exigem conferência do conteúdo antes de qualquer alteração.</p>}
    </section> : null}
    {feedback ? <p className="import-status">{feedback}</p> : null}

    <div className="health-actions">
      <button className="secondary-outline" disabled={busy} onClick={() => void check()}>{busy ? 'Verificando…' : 'Verificar novamente'}</button>
      <button className="primary-action" disabled={busy || !health?.online} onClick={() => void repair()}>Reparar catálogo</button>
    </div>
    <small className="health-note">O reparo reutiliza cartões existentes sempre que possível e não apaga seu histórico de revisões.</small>
  </section>;
}
