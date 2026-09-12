import { useEffect, useMemo, useState } from 'react';
import { buildEditalSubjects } from '@core/features/edital/edital-model';
import type { SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { listStudyCardCountsByTopic } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { PageHeader } from '../shared/PageHeader';
import { MetricTile } from '../shared/MetricTile';

type Props = {
  profileId: string;
  subjects: SubjectRow[];
  topics: TopicRow[];
  onStudyTopic: (subjectId: string, topicId: string) => void;
};

export function EditalPage({ profileId, subjects, topics, onStudyTopic }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [cardCounts, setCardCounts] = useState<Map<string, number>>(new Map());
  const baseRows = useMemo(() => buildEditalSubjects(subjects, topics, query), [subjects, topics, query]);
  const allSubjects = useMemo(() => buildEditalSubjects(subjects, topics, ''), [subjects, topics]);

  useEffect(() => {
    let cancelled = false;
    void listStudyCardCountsByTopic(getSupabaseClient(), profileId).then((counts) => {
      if (!cancelled) setCardCounts(counts);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [profileId]);

  const rows = useMemo(() => {
    if (!onlyMissing) return baseRows;
    return baseRows
      .map((subject) => ({ ...subject, rootTopics: subject.rootTopics.filter((topic) => !(cardCounts.get(topic.id) ?? 0)) }))
      .filter((subject) => subject.rootTopics.length > 0);
  }, [baseRows, onlyMissing, cardCounts]);

  const coverage = useMemo(() => {
    let totalTopics = 0;
    let coveredTopics = 0;
    let totalCards = 0;
    let subjectsCovered = 0;
    for (const subject of allSubjects) {
      totalTopics += subject.rootTopics.length;
      const covered = subject.rootTopics.filter((topic) => (cardCounts.get(topic.id) ?? 0) > 0);
      coveredTopics += covered.length;
      totalCards += covered.reduce((sum, topic) => sum + (cardCounts.get(topic.id) ?? 0), 0);
      if (covered.length > 0) subjectsCovered += 1;
    }
    return { totalTopics, coveredTopics, totalCards, subjectsCovered, totalSubjects: allSubjects.length };
  }, [allSubjects, cardCounts]);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="EDITAL VERTICALIZADO"
        title="Mapa do edital"
        subtitle="Disciplinas e tópicos transformados em uma árvore de estudo, com base legal e prioridade quando disponíveis."
        action={
          <div className="lei-seca-header-actions">
            <div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no edital" /></div>
            <button type="button" className={`missing-toggle ${onlyMissing ? 'active' : ''}`} onClick={() => setOnlyMissing((current) => !current)}>
              {onlyMissing ? '✓ ' : ''}Só o que falta
            </button>
          </div>
        }
      />
      <div className="dashboard-grid lei-seca-metrics">
        <MetricTile label="Assuntos com cartões" value={`${coverage.coveredTopics}/${coverage.totalTopics}`} helper="do total de assuntos do edital" />
        <MetricTile label="Disciplinas iniciadas" value={`${coverage.subjectsCovered}/${coverage.totalSubjects}`} helper="com ao menos 1 cartão" />
        <MetricTile label="Cartões de estudo" value={coverage.totalCards} helper="flashcards cadastrados no total" />
        <MetricTile label="Cobertura geral" value={coverage.totalTopics ? `${Math.round((coverage.coveredTopics / coverage.totalTopics) * 100)}%` : '0%'} helper="dos assuntos já com flashcard" />
      </div>
      {!rows.length ? (
        <div className="study-empty">
          <strong>{onlyMissing ? 'Tudo coberto por aqui! 🎉' : 'Nenhum assunto cadastrado ainda.'}</strong>
          <span>{onlyMissing ? 'Todos os assuntos do edital já têm ao menos um flashcard.' : 'Quando as disciplinas forem carregadas, elas aparecerão aqui.'}</span>
        </div>
      ) : (
        <div className="edital-tree">
          {rows.map((subject, index) => {
            const open = expanded.has(subject.id);
            const subjectCovered = subject.rootTopics.filter((topic) => (cardCounts.get(topic.id) ?? 0) > 0).length;
            return (
              <section key={subject.id} className="edital-subject">
                <button className="edital-subject-head" onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  open ? next.delete(subject.id) : next.add(subject.id);
                  return next;
                })}>
                  <span className="subject-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="subject-title">
                    <strong>{subject.name}</strong>
                    <small>{onlyMissing
                      ? `${subject.rootTopics.length} tópico${subject.rootTopics.length === 1 ? '' : 's'} sem cartão`
                      : `${subject.rootTopics.length} tópicos · ${subjectCovered} com cartão ${subject.priority ? `· Prioridade ${subject.priority}` : ''}`}</small>
                  </span>
                  {subject.weight ? <span className="weight-pill">{subject.weight}%</span> : null}
                  <span className="expand-icon">{open ? '−' : '+'}</span>
                </button>
                {open ? <div className="topic-list">{subject.rootTopics.map((topic) => {
                  const count = cardCounts.get(topic.id) ?? 0;
                  return (
                    <div key={topic.id} className="topic-row-wrap">
                      <div className="topic-row">
                        <span className="topic-check">○</span>
                        <div><strong>{topic.name}</strong>{topic.edital_text ? <p>{topic.edital_text}</p> : null}{topic.legal_basis ? <small>Base legal: {topic.legal_basis}</small> : null}</div>
                        {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>{topic.priority}</span> : null}
                      </div>
                      {count > 0 ? (
                        <div className="topic-actions">
                          <button className="link-button" onClick={() => onStudyTopic(subject.id, topic.id)}>Estudar este assunto ({count} cartão{count === 1 ? '' : 'ões'}) →</button>
                        </div>
                      ) : null}
                    </div>
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
