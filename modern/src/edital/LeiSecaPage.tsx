import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { DeckRow, SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { listCardsByType, listStudyCardTopicIds, setCardReadAt, type CardRow } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { PageHeader } from '../shared/PageHeader';
import { MetricTile } from '../shared/MetricTile';
import { importCards, markImportDuplicates, type ImportCandidate } from '../cards/card-manager-repository';
import { parseLeiSecaPdfImport } from '../cards/pdf-import';
import '../cards/card-manager.css';
import '../cards/pdf-import.css';

type LeiSecaSubject = SubjectRow & { rootTopics: TopicRow[] };

const LEI_SECA_EXCLUDED_SUBJECTS = new Set(['português']);

function buildLeiSecaSubjects(subjects: SubjectRow[], topics: TopicRow[], query: string): LeiSecaSubject[] {
  const normalized = query.trim().toLowerCase();
  return subjects
    .filter((subject) => !LEI_SECA_EXCLUDED_SUBJECTS.has(subject.name.trim().toLowerCase()))
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
  user: User;
  profileId: string;
  subjects: SubjectRow[];
  topics: TopicRow[];
  decks: DeckRow[];
  onStudyTopic: (subjectId: string, topicId: string) => void;
};

export function LeiSecaPage({ user, profileId, subjects, topics, decks, onStudyTopic }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [cardsByTopic, setCardsByTopic] = useState<Map<string, CardRow[]>>(new Map());
  const [studyTopicIds, setStudyTopicIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importTopicId, setImportTopicId] = useState('');
  const [importLawLabel, setImportLawLabel] = useState('');
  const [importRows, setImportRows] = useState<ImportCandidate[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const rows = useMemo(() => buildLeiSecaSubjects(subjects, topics, query), [subjects, topics, query]);
  const allSubjects = useMemo(() => buildLeiSecaSubjects(subjects, topics, ''), [subjects, topics]);

  const coverage = useMemo(() => {
    let totalTopics = 0;
    let coveredTopics = 0;
    let totalCards = 0;
    let readCards = 0;
    let subjectsCovered = 0;
    for (const subject of allSubjects) {
      totalTopics += subject.rootTopics.length;
      const covered = subject.rootTopics.filter((topic) => (cardsByTopic.get(topic.id)?.length ?? 0) > 0);
      coveredTopics += covered.length;
      for (const topic of covered) {
        const cards = cardsByTopic.get(topic.id) ?? [];
        totalCards += cards.length;
        readCards += cards.filter((card) => card.read_at).length;
      }
      if (covered.length > 0) subjectsCovered += 1;
    }
    return { totalTopics, coveredTopics, totalCards, readCards, subjectsCovered, totalSubjects: allSubjects.length };
  }, [allSubjects, cardsByTopic]);

  function reloadCards() {
    return Promise.all([
      listCardsByType(getSupabaseClient(), profileId, 'Lei seca'),
      listStudyCardTopicIds(getSupabaseClient(), profileId),
    ]).then(([cards, topicIds]) => {
      const grouped = new Map<string, CardRow[]>();
      for (const card of cards) {
        if (!card.topic_id) continue;
        const bucket = grouped.get(card.topic_id) ?? [];
        bucket.push(card);
        grouped.set(card.topic_id, bucket);
      }
      setCardsByTopic(grouped);
      setStudyTopicIds(topicIds);
    });
  }

  useEffect(() => {
    let cancelled = false;
    void reloadCards().catch(() => { if (!cancelled) undefined; });
    return () => { cancelled = true; };
  }, [profileId]);

  function openImport(topicId: string) {
    const topic = topics.find((entry) => entry.id === topicId);
    setImportTopicId(topicId);
    setImportLawLabel(topic?.legal_basis?.split(',')[0]?.trim() || 'CF');
    setImportRows([]);
    setImportStatus(null);
    setImportOpen(true);
  }

  function closeImport() {
    setImportOpen(false);
    setImportRows([]);
    setImportStatus(null);
  }

  async function parseImportFile(file: File) {
    const topic = topics.find((entry) => entry.id === importTopicId);
    if (!topic) return;
    const deck = decks.find((entry) => entry.subject_id === topic.subject_id) || decks[0];
    if (!deck) { setImportStatus('Nenhum baralho encontrado para esta matéria.'); return; }
    setImportBusy(true); setImportStatus('Lendo PDF…'); setImportRows([]);
    try {
      const parsed = await parseLeiSecaPdfImport(file, {
        lawLabel: importLawLabel.trim() || 'CF',
        subjectId: topic.subject_id,
        topicId: topic.id,
        deckId: deck.id,
      });
      const marked = await markImportDuplicates(getSupabaseClient(), profileId, parsed);
      setImportRows(marked);
      setImportStatus(`${marked.length} cartões encontrados (1 por página do PDF) · ${marked.filter((row) => row.duplicate).length} duplicados bloqueados.`);
    } catch (cause) {
      setImportStatus(`Não foi possível processar o PDF: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    setImportBusy(true);
    try {
      const result = await importCards(getSupabaseClient(), user, profileId, importRows);
      setImportStatus(`${result.inserted} cartões importados · ${result.duplicates} duplicados ignorados · ${result.failed} falhas.`);
      await reloadCards();
      setImportRows(await markImportDuplicates(getSupabaseClient(), profileId, importRows));
    } finally {
      setImportBusy(false);
    }
  }

  function toggleTopicCards(topicId: string) {
    setOpenTopics((current) => {
      const next = new Set(current);
      next.has(topicId) ? next.delete(topicId) : next.add(topicId);
      return next;
    });
  }

  function toggleRead(card: CardRow) {
    const nextRead = !card.read_at;
    setCardsByTopic((current) => {
      const next = new Map(current);
      const topicId = card.topic_id;
      if (!topicId) return current;
      const bucket = (next.get(topicId) ?? []).map((entry) => entry.id === card.id ? { ...entry, read_at: nextRead ? new Date().toISOString() : null } : entry);
      next.set(topicId, bucket);
      return next;
    });
    void setCardReadAt(getSupabaseClient(), card.id, nextRead).catch(() => void reloadCards());
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="LEI SECA"
        title="Artigos por matéria e assunto"
        subtitle="Cada assunto do edital com a base legal indicada e, quando disponível, cartões para revisar o texto do artigo."
        action={<div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar norma ou assunto" /></div>}
      />
      <div className="dashboard-grid four">
        <MetricTile label="Assuntos com Lei Seca" value={`${coverage.coveredTopics}/${coverage.totalTopics}`} helper="do total de assuntos com base legal" />
        <MetricTile label="Disciplinas iniciadas" value={`${coverage.subjectsCovered}/${coverage.totalSubjects}`} helper="com ao menos 1 assunto cadastrado" />
        <MetricTile label="Cartões de Lei Seca" value={coverage.totalCards} helper="trechos importados no total" />
        <MetricTile label="Trechos lidos" value={`${coverage.readCards}/${coverage.totalCards}`} helper="marcados como lidos" />
        <MetricTile label="Cobertura geral" value={coverage.totalTopics ? `${Math.round((coverage.coveredTopics / coverage.totalTopics) * 100)}%` : '0%'} helper="dos assuntos já com texto de lei" />
      </div>
      {!rows.length ? (
        <div className="study-empty"><strong>Nenhum artigo cadastrado ainda.</strong><span>Quando os assuntos tiverem base legal registrada, eles aparecerão aqui por matéria.</span></div>
      ) : (
        <div className="edital-tree">
          {rows.map((subject, index) => {
            const open = expanded.has(subject.id);
            const subjectCovered = subject.rootTopics.filter((topic) => (cardsByTopic.get(topic.id)?.length ?? 0) > 0).length;
            return (
              <section key={subject.id} className="edital-subject">
                <button className="edital-subject-head" onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  open ? next.delete(subject.id) : next.add(subject.id);
                  return next;
                })}>
                  <span className="subject-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="subject-title"><strong>{subject.name}</strong><small>{subject.rootTopics.length} assunto{subject.rootTopics.length === 1 ? '' : 's'} · {subjectCovered} com Lei Seca</small></span>
                  <span className="expand-icon">{open ? '−' : '+'}</span>
                </button>
                {open ? <div className="topic-list">{subject.rootTopics.map((topic) => {
                  const topicCards = cardsByTopic.get(topic.id) ?? [];
                  const cardsOpen = openTopics.has(topic.id);
                  const readCount = topicCards.filter((card) => card.read_at).length;
                  return (
                    <div key={topic.id} className="topic-row-wrap">
                      <div className="topic-row">
                        <span className="topic-check">§</span>
                        <div><strong>{topic.name}</strong><p>{topic.legal_basis}</p></div>
                        {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>{topic.priority}</span> : null}
                      </div>
                      <div className="topic-actions">
                        {topicCards.length ? (
                          <button className="link-button" onClick={() => toggleTopicCards(topic.id)}>{cardsOpen ? 'Ocultar leitura' : 'Ler'} {topicCards.length} trecho{topicCards.length === 1 ? '' : 's'}{readCount ? ` (${readCount} lido${readCount === 1 ? '' : 's'})` : ''}</button>
                        ) : null}
                        {studyTopicIds.has(topic.id) ? (
                          <button className="link-button" onClick={() => onStudyTopic(subject.id, topic.id)}>Estudar este assunto →</button>
                        ) : null}
                        <button className="link-button" onClick={() => openImport(topic.id)}>Importar cartões (PDF) →</button>
                      </div>
                      {cardsOpen ? <div className="topic-cards topic-reading">{topicCards.map((card) => (
                        <article key={card.id} className={`topic-reading-item ${card.read_at ? 'is-read' : ''}`}>
                          <div className="topic-reading-head">
                            <h3>{card.front}</h3>
                            <button className={`read-toggle ${card.read_at ? 'is-read' : ''}`} onClick={() => toggleRead(card)}>{card.read_at ? '✓ Lido' : 'Marcar como lido'}</button>
                          </div>
                          <p>{card.back}</p>
                        </article>
                      ))}</div> : null}
                    </div>
                  );
                })}</div> : null}
              </section>
            );
          })}
        </div>
      )}
      {importOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card import-modal">
            <div className="modal-heading">
              <div>
                <span className="page-eyebrow">PDF → LEI SECA</span>
                <h2>Importar cartões de Lei Seca</h2>
                <p>Cada página do PDF vira um cartão: a frente traz a citação do artigo detectada automaticamente e o verso traz o texto integral da página.</p>
              </div>
              <button className="modal-close" onClick={closeImport}>×</button>
            </div>
            <div className="form-grid pdf-defaults">
              <label>
                <span>Assunto de destino</span>
                <select value={importTopicId} onChange={(event) => openImport(event.target.value)}>
                  {topics.filter((topic) => !topic.parent_id && topic.legal_basis).map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Norma (usada na citação, ex.: CF, CLT)</span>
                <input value={importLawLabel} onChange={(event) => setImportLawLabel(event.target.value)} placeholder="CF" />
              </label>
            </div>
            <label className="file-drop pdf-drop">
              <input type="file" accept="application/pdf,.pdf" disabled={importBusy || !importTopicId} onChange={(event) => event.target.files?.[0] && void parseImportFile(event.target.files[0])} />
              <strong>{importBusy ? 'Processando…' : 'Escolher arquivo PDF'}</strong>
              <span>O arquivo é processado no navegador; o PDF original não é enviado ao banco.</span>
            </label>
            {importStatus ? <p className="import-status">{importStatus}</p> : null}
            {importRows.length ? (
              <div className="import-preview">
                <div className="import-preview-head"><strong>Pré-visualização</strong><span>{importRows.filter((row) => !row.duplicate).length} aptos para importar</span></div>
                {importRows.slice(0, 100).map((row) => (
                  <div className={`import-row ${row.duplicate ? 'duplicate' : ''}`} key={row.row}>
                    <span>{row.row}</span>
                    <div><strong>{row.front || 'Citação vazia'}</strong><small>{row.back || 'Texto vazio'}</small>{row.duplicateReason ? <em>{row.duplicateReason}</em> : null}</div>
                    <span>{row.duplicate ? 'Duplicado' : 'Novo'}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="modal-actions">
              <button className="secondary-outline" onClick={closeImport}>Fechar</button>
              <button className="primary-action" disabled={importBusy || !importRows.some((row) => !row.duplicate)} onClick={() => void confirmImport()}>Importar válidos</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
