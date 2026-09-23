import { useEffect, useMemo, useState } from 'react';
import { buildEditalSubjects } from '@core/features/edital/edital-model';
import type { SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { listEditalTopicProgress, type EditalTopicProgress } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { PageHeader } from '../shared/PageHeader';
import { MetricTile } from '../shared/MetricTile';

type Props = {
  profileId: string;
  subjects: SubjectRow[];
  topics: TopicRow[];
  onStudyTopic: (subjectId: string, topicId: string) => void;
  onOpenLeiSeca: () => void;
};

type StatusFilter = 'all' | EditalTopicProgress['status'];
type PriorityFilter = 'all' | 'A' | 'B' | 'C';

const STATUS_ORDER: EditalTopicProgress['status'][] = ['Não iniciado', 'Em estudo', 'Revisado', 'Dominado'];
const COMPLEMENTARY_TOPICS = new Set(['Jurisprudência prioritária STF/TST', 'Estudo de Caso Jurídico - protocolo de treino']);

function emptyProgress(): EditalTopicProgress {
  return { cardCount: 0, leiSecaCount: 0, reviewedCount: 0, masteredCount: 0, status: 'Não iniciado' };
}

function statusClass(status: EditalTopicProgress['status']): string {
  if (status === 'Dominado') return 'status-mastered';
  if (status === 'Revisado') return 'status-reviewed';
  if (status === 'Em estudo') return 'status-studying';
  return 'status-not-started';
}

export function EditalPage({ profileId, subjects, topics, onStudyTopic, onOpenLeiSeca }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [progress, setProgress] = useState<Map<string, EditalTopicProgress>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const allSubjects = useMemo(() => buildEditalSubjects(subjects, topics, '').map((subject) => ({ ...subject, rootTopics: subject.rootTopics.filter((topic) => !COMPLEMENTARY_TOPICS.has(topic.name)) })).filter((subject) => subject.rootTopics.length > 0), [subjects, topics]);
  const searchedSubjects = useMemo(() => buildEditalSubjects(subjects, topics, query).map((subject) => ({ ...subject, rootTopics: subject.rootTopics.filter((topic) => !COMPLEMENTARY_TOPICS.has(topic.name)) })).filter((subject) => subject.rootTopics.length > 0), [subjects, topics, query]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void listEditalTopicProgress(getSupabaseClient(), profileId)
      .then((rows) => { if (!cancelled) setProgress(rows); })
      .catch((cause) => { if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar o progresso do edital.'); });
    return () => { cancelled = true; };
  }, [profileId]);

  const rows = useMemo(() => searchedSubjects
    .map((subject) => ({
      ...subject,
      rootTopics: subject.rootTopics.filter((topic) => {
        const item = progress.get(topic.id) ?? emptyProgress();
        if (priority !== 'all' && topic.priority !== priority) return false;
        if (status !== 'all' && item.status !== status) return false;
        return true;
      }),
    }))
    .filter((subject) => subject.rootTopics.length > 0), [searchedSubjects, priority, status, progress]);

  const coverage = useMemo(() => {
    let totalTopics = 0;
    let coveredTopics = 0;
    let totalCards = 0;
    let leiSecaTopics = 0;
    let masteredTopics = 0;

    for (const subject of allSubjects) {
      for (const topic of subject.rootTopics) {
        totalTopics += 1;
        const item = progress.get(topic.id) ?? emptyProgress();
        if (item.cardCount > 0) coveredTopics += 1;
        if (item.leiSecaCount > 0 || Boolean(topic.legal_basis)) leiSecaTopics += 1;
        if (item.status === 'Dominado') masteredTopics += 1;
        totalCards += item.cardCount;
      }
    }

    return { totalTopics, coveredTopics, totalCards, leiSecaTopics, masteredTopics };
  }, [allSubjects, progress]);

  const coveragePct = coverage.totalTopics ? Math.round((coverage.coveredTopics / coverage.totalTopics) * 100) : 0;
  const masteredPct = coverage.totalTopics ? Math.round((coverage.masteredTopics / coverage.totalTopics) * 100) : 0;

  function toggleSubject(subjectId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      return next;
    });
  }

  return (
    <div className="page-wrap edital-command-page">
      <PageHeader
        eyebrow="EDITAL VERTICALIZADO"
        title="Centro de comando do edital"
        subtitle="Veja exatamente o que precisa dominar, o que já possui material e qual é o próximo ponto de estudo."
        action={
          <div className="edital-command-actions">
            <div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar disciplina, assunto ou base legal" /></div>
          </div>
        }
      />

      {loadError ? <div className="notice error"><strong>Progresso indisponível.</strong><span>{loadError}</span></div> : null}

      <section className="edital-overview">
        <div className="edital-overview-copy">
          <span className="page-eyebrow">PROGRESSO GERAL</span>
          <h2>{coverage.coveredTopics}/{coverage.totalTopics} tópicos com material de estudo</h2>
          <p>O percentual abaixo mede cobertura do edital. “Dominado” só aparece quando os cartões do tópico já foram respondidos com desempenho suficiente.</p>
        </div>
        <strong>{coveragePct}%</strong>
        <div className="edital-progress-track"><span style={{ width: `${coveragePct}%` }} /></div>
      </section>

      <div className="dashboard-grid edital-command-metrics">
        <MetricTile label="Tópicos cobertos" value={`${coverage.coveredTopics}/${coverage.totalTopics}`} helper="com flashcards vinculados" />
        <MetricTile label="Dominados" value={coverage.masteredTopics} helper={`${masteredPct}% do edital`} />
        <MetricTile label="Cartões de estudo" value={coverage.totalCards} helper="sem contar Lei Seca" />
        <MetricTile label="Com base legal" value={coverage.leiSecaTopics} helper="aptos para leitura de Lei Seca" />
        <MetricTile label="Camada 4" value="+360" helper="aprofundamento, jurisprudência e Estudo de Caso" />
      </div>

      <section className="edital-filter-bar">
        <div>
          <span>Prioridade</span>
          <div className="filter-pills">
            {(['all','A','B','C'] as PriorityFilter[]).map((item) => <button key={item} className={priority === item ? 'active' : ''} onClick={() => setPriority(item)}>{item === 'all' ? 'Todas' : item}</button>)}
          </div>
        </div>
        <div>
          <span>Status</span>
          <div className="filter-pills status-filter-pills">
            <button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Todos</button>
            {STATUS_ORDER.map((item) => <button key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>{item}</button>)}
          </div>
        </div>
      </section>

      {!rows.length ? (
        <div className="study-empty"><strong>Nenhum tópico neste filtro.</strong><span>Altere a busca, prioridade ou status.</span></div>
      ) : (
        <div className="edital-tree edital-command-tree">
          {rows.map((subject, index) => {
            const open = expanded.has(subject.id);
            const allTopicCount = allSubjects.find((item) => item.id === subject.id)?.rootTopics.length ?? subject.rootTopics.length;
            const coveredCount = (allSubjects.find((item) => item.id === subject.id)?.rootTopics ?? subject.rootTopics)
              .filter((topic) => (progress.get(topic.id)?.cardCount ?? 0) > 0).length;
            const subjectPct = allTopicCount ? Math.round((coveredCount / allTopicCount) * 100) : 0;

            return (
              <section key={subject.id} className="edital-subject">
                <button className="edital-subject-head edital-command-subject-head" onClick={() => toggleSubject(subject.id)}>
                  <span className="subject-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="subject-title">
                    <strong>{subject.name}</strong>
                    <small>{coveredCount}/{allTopicCount} tópicos cobertos · {subjectPct}%{subject.priority ? ` · Prioridade ${subject.priority}` : ''}</small>
                    <span className="subject-progress-track"><i style={{ width: `${subjectPct}%` }} /></span>
                  </span>
                  {subject.weight ? <span className="weight-pill">{subject.weight}%</span> : null}
                  <span className="expand-icon">{open ? '−' : '+'}</span>
                </button>

                {open ? <div className="topic-list edital-command-topics">{subject.rootTopics.map((topic) => {
                  const item = progress.get(topic.id) ?? emptyProgress();
                  const hasLaw = item.leiSecaCount > 0 || Boolean(topic.legal_basis);
                  return (
                    <article key={topic.id} className="edital-topic-card">
                      <div className="edital-topic-main">
                        <div className="edital-topic-title-row">
                          <span className={`edital-status-pill ${statusClass(item.status)}`}>{item.status}</span>
                          {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>Prioridade {topic.priority}</span> : null}
                        </div>
                        <h3>{topic.name}</h3>
                        {topic.edital_text ? <p>{topic.edital_text}</p> : null}
                        {topic.legal_basis ? <small><strong>Base legal:</strong> {topic.legal_basis}</small> : null}
                        <div className="edital-topic-meta">
                          <span><strong>{item.cardCount}</strong> cartões</span>
                          <span><strong>{item.reviewedCount}</strong> respondidos</span>
                          <span><strong>{item.masteredCount}</strong> consolidados</span>
                          <span className={hasLaw ? 'available' : ''}>{hasLaw ? 'Lei Seca disponível' : 'Sem base legal cadastrada'}</span>
                        </div>
                      </div>
                      <div className="edital-topic-actions">
                        <button className="primary-action" disabled={item.cardCount === 0} onClick={() => onStudyTopic(subject.id, topic.id)}>Estudar</button>
                        <button className="secondary-outline" disabled={!hasLaw} onClick={onOpenLeiSeca}>Lei Seca</button>
                        <button className="secondary-outline" disabled title="Integração de questões ainda não ativada nesta tela">Questões</button>
                      </div>
                    </article>
                  );
                })}</div> : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
