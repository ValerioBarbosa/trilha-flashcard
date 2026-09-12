import { useEffect, useMemo, useState } from 'react';
import type { SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { listCardsByType, type CardRow } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { PageHeader } from '../shared/PageHeader';

type LeiSecaSubject = SubjectRow & { rootTopics: TopicRow[] };

function buildLeiSecaSubjects(subjects: SubjectRow[], topics: TopicRow[], query: string): LeiSecaSubject[] {
  const normalized = query.trim().toLowerCase();
  return subjects
    .map((subject) => ({
      ...subject,
      rootTopics: topics.filter((topic) => topic.subject_id === subject.id && !topic.parent_id && topic.legal_basis),
    }))
    .filter((subject) => subject.rootTopics.length > 0)
    .filter((subject) => {
      if (!normalized) return true;
      return subject.name.toLowerCase().includes(normalized)
        || subject.rootTopics.some((topic) => `${topic.name} ${topic.legal_basis ?? ''}`.toLowerCase().includes(normalized));
    });
}

type Props = {
  profileId: string;
  subjects: SubjectRow[];
  topics: TopicRow[];
  onStudyTopic: (subjectId: string, topicId: string) => void;
};

export function LeiSecaPage({ profileId, subjects, topics, onStudyTopic }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [cardsByTopic, setCardsByTopic] = useState<Map<string, CardRow[]>>(new Map());
  const rows = useMemo(() => buildLeiSecaSubjects(subjects, topics, query), [subjects, topics, query]);

  useEffect(() => {
    let cancelled = false;
    void listCardsByType(getSupabaseClient(), profileId, 'Lei seca').then((cards) => {
      if (cancelled) return;
      const grouped = new Map<string, CardRow[]>();
      for (const card of cards) {
        if (!card.topic_id) continue;
        const bucket = grouped.get(card.topic_id) ?? [];
        bucket.push(card);
        grouped.set(card.topic_id, bucket);
      }
      setCardsByTopic(grouped);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [profileId]);

  function toggleTopicCards(topicId: string) {
    setOpenTopics((current) => {
      const next = new Set(current);
      next.has(topicId) ? next.delete(topicId) : next.add(topicId);
      return next;
    });
  }

  function toggleReveal(cardId: string) {
    setRevealedCards((current) => {
      const next = new Set(current);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="LEI SECA"
        title="Artigos por matéria e assunto"
        subtitle="Cada assunto do edital com a base legal indicada e, quando disponível, cartões para revisar o texto do artigo."
        action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar norma ou assunto" /></div>}
      />
      {!rows.length ? (
        <div className="study-empty"><strong>Nenhum artigo cadastrado ainda.</strong><span>Quando os assuntos tiverem base legal registrada, eles aparecerão aqui por matéria.</span></div>
      ) : (
        <div className="edital-tree">
          {rows.map((subject, index) => {
            const open = expanded.has(subject.id);
            return (
              <section key={subject.id} className="edital-subject">
                <button className="edital-subject-head" onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  open ? next.delete(subject.id) : next.add(subject.id);
                  return next;
                })}>
                  <span className="subject-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="subject-title"><strong>{subject.name}</strong><small>{subject.rootTopics.length} artigo{subject.rootTopics.length === 1 ? '' : 's'}</small></span>
                  <span className="expand-icon">{open ? '−' : '+'}</span>
                </button>
                {open ? <div className="topic-list">{subject.rootTopics.map((topic) => {
                  const topicCards = cardsByTopic.get(topic.id) ?? [];
                  const cardsOpen = openTopics.has(topic.id);
                  return (
                    <div key={topic.id} className="topic-row-wrap">
                      <div className="topic-row">
                        <span className="topic-check">§</span>
                        <div><strong>{topic.name}</strong><p>{topic.legal_basis}</p></div>
                        {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>{topic.priority}</span> : null}
                      </div>
                      <div className="topic-actions">
                        {topicCards.length ? (
                          <button className="link-button" onClick={() => toggleTopicCards(topic.id)}>{cardsOpen ? 'Ocultar' : 'Ver'} {topicCards.length} cartão{topicCards.length === 1 ? '' : 'es'}</button>
                        ) : null}
                        {topicCards.length ? (
                          <button className="link-button" onClick={() => onStudyTopic(subject.id, topic.id)}>Estudar este assunto →</button>
                        ) : null}
                      </div>
                      {cardsOpen ? <div className="topic-cards">{topicCards.map((card) => (
                        <div key={card.id} className="topic-card-item">
                          <button onClick={() => toggleReveal(card.id)}>{card.front}</button>
                          {revealedCards.has(card.id) ? <div className="card-answer-inline"><p>{card.back}</p>{card.legal_basis ? <small>Base legal: {card.legal_basis}</small> : null}</div> : null}
                        </div>
                      ))}</div> : null}
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
