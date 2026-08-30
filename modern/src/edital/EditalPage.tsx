import { useMemo, useState } from 'react';
import { buildEditalSubjects } from '@core/features/edital/edital-model';
import type { SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { PageHeader } from '../shared/PageHeader';

export function EditalPage({ subjects, topics }: { subjects: SubjectRow[]; topics: TopicRow[] }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = useMemo(() => buildEditalSubjects(subjects, topics, query), [subjects, topics, query]);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="EDITAL VERTICALIZADO"
        title="Mapa do edital"
        subtitle="Disciplinas e tópicos transformados em uma árvore de estudo, com base legal e prioridade quando disponíveis."
        action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no edital" /></div>}
      />
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
                <span className="subject-title"><strong>{subject.name}</strong><small>{subject.rootTopics.length} tópicos {subject.priority ? `· Prioridade ${subject.priority}` : ''}</small></span>
                {subject.weight ? <span className="weight-pill">{subject.weight}%</span> : null}
                <span className="expand-icon">{open ? '−' : '+'}</span>
              </button>
              {open ? <div className="topic-list">{subject.rootTopics.map((topic) => (
                <div key={topic.id} className="topic-row">
                  <span className="topic-check">○</span>
                  <div><strong>{topic.name}</strong>{topic.edital_text ? <p>{topic.edital_text}</p> : null}{topic.legal_basis ? <small>Base legal: {topic.legal_basis}</small> : null}</div>
                  {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>{topic.priority}</span> : null}
                </div>
              ))}</div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
