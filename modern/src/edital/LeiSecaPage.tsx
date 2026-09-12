import { useMemo, useState } from 'react';
import type { SubjectRow, TopicRow } from '@core/features/study/domain-repository';
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

export function LeiSecaPage({ subjects, topics }: { subjects: SubjectRow[]; topics: TopicRow[] }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = useMemo(() => buildLeiSecaSubjects(subjects, topics, query), [subjects, topics, query]);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="LEI SECA"
        title="Artigos por matéria e assunto"
        subtitle="Cada assunto do edital com a base legal indicada, organizado igual à árvore do Edital."
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
                {open ? <div className="topic-list">{subject.rootTopics.map((topic) => (
                  <div key={topic.id} className="topic-row">
                    <span className="topic-check">§</span>
                    <div><strong>{topic.name}</strong><p>{topic.legal_basis}</p></div>
                    {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>{topic.priority}</span> : null}
                  </div>
                ))}</div> : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
