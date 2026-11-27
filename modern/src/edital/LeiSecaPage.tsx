import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { DeckRow, SubjectRow, TopicRow } from '@core/features/study/domain-repository';
import { listCardsByType, listStudyCardCountsByTopic, setCardReadAt, type CardRow } from '../study/domain-repository';
import { getSupabaseClient } from '../lib/supabase-client';
import { PageHeader } from '../shared/PageHeader';
import { MetricTile } from '../shared/MetricTile';
import { createCard, importCards, markImportDuplicates, type ImportCandidate, type CardDraft } from '../cards/card-manager-repository';
import { parseLeiSecaPdfImport } from '../cards/pdf-import';
import '../cards/card-manager.css';
import '../cards/pdf-import.css';
import { highlightLawText, LAW_HIGHLIGHT_LABELS } from './law-highlights';

type LeiSecaSubject = SubjectRow & { rootTopics: TopicRow[] };

const LEI_SECA_EXCLUDED_SUBJECTS = new Set(['portugues', 'lingua portuguesa', 'matematica e raciocinio logico', 'matematica rlm', 'raciocinio logico', 'nocoes de informatica', 'informatica']);
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function buildLeiSecaSubjects(subjects: SubjectRow[], topics: TopicRow[], query: string): LeiSecaSubject[] {
  const normalized = normalizeSearch(query);
  return subjects
    .filter((subject) => !LEI_SECA_EXCLUDED_SUBJECTS.has(normalizeSearch(subject.name)))
    .map((subject) => ({
      ...subject,
      rootTopics: topics.filter((topic) => topic.subject_id === subject.id && !topic.parent_id && topic.legal_basis),
    }))
    .filter((subject) => subject.rootTopics.length > 0)
    .filter((subject) => {
      if (!normalized) return true;
      return normalizeSearch(subject.name).includes(normalized)
        || subject.rootTopics.some((topic) => normalizeSearch(`${topic.name} ${topic.legal_basis ?? ''}`).includes(normalized));
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
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [readerNote, setReaderNote] = useState('');
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [readerFont, setReaderFont] = useState(19);
  const [immersive, setImmersive] = useState(false);
  const [highlights, setHighlights] = useState(false);
  const [readerFavorite, setReaderFavorite] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reader, setReader] = useState<{ topicId: string; index: number } | null>(null);
  const [cardsByTopic, setCardsByTopic] = useState<Map<string, CardRow[]>>(new Map());
  const [studyTopicIds, setStudyTopicIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importTopicId, setImportTopicId] = useState('');
  const [importLawLabel, setImportLawLabel] = useState('');
  const [importRows, setImportRows] = useState<ImportCandidate[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const baseRows = useMemo(() => buildLeiSecaSubjects(subjects, topics, query), [subjects, topics, query]);
  const allSubjects = useMemo(() => buildLeiSecaSubjects(subjects, topics, ''), [subjects, topics]);
  const rows = useMemo(() => {
    let result = baseRows;
    if (onlyMissing) {
      result = result
        .map((subject) => ({ ...subject, rootTopics: subject.rootTopics.filter((topic) => (cardsByTopic.get(topic.id)?.length ?? 0) === 0) }))
        .filter((subject) => subject.rootTopics.length > 0);
    }
    if (onlyUnread) {
      result = result
        .map((subject) => ({ ...subject, rootTopics: subject.rootTopics.filter((topic) => {
          const cards = cardsByTopic.get(topic.id) ?? [];
          return cards.some((card) => !card.read_at);
        }) }))
        .filter((subject) => subject.rootTopics.length > 0);
    }
    return result;
  }, [baseRows, onlyMissing, onlyUnread, cardsByTopic]);

  const favoriteCards = useMemo(() => {
    const allowed = new Set(baseRows.flatMap((subject) => subject.rootTopics.map((topic) => topic.id)));
    return [...cardsByTopic.entries()].flatMap(([topicId, cards]) => {
      if (!allowed.has(topicId)) return [];
      return cards.flatMap((card, index) => {
        try {
          return window.localStorage.getItem(`trilha-law-favorite:${profileId}:${card.id}`) === '1' && (!onlyUnread || !card.read_at)
            ? [{ card, topicId, index }] : [];
        } catch { return []; }
      });
    });
  }, [baseRows, cardsByTopic, profileId, favoriteVersion, onlyUnread]);

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
    setLoadError(null);
    return Promise.all([
      listCardsByType(getSupabaseClient(), profileId, 'Lei seca'),
      listStudyCardCountsByTopic(getSupabaseClient(), profileId),
    ]).then(([cards, counts]) => {
      const grouped = new Map<string, CardRow[]>();
      for (const card of cards) {
        if (!card.topic_id) continue;
        const bucket = grouped.get(card.topic_id) ?? [];
        bucket.push(card);
        grouped.set(card.topic_id, bucket);
      }
      setCardsByTopic(grouped);
      setStudyTopicIds(new Set(counts.keys()));
    });
  }

  useEffect(() => {
    let cancelled = false;
    void reloadCards().catch((cause) => {
      if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar a Lei Seca.');
    });
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
    } catch (cause) {
      setImportStatus(`Falha ao importar: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setImportBusy(false);
    }
  }

  function readerStorageKey(cardId: string) { return `trilha-law-note:${profileId}:${cardId}`; }
  function favoriteStorageKey(cardId: string) { return `trilha-law-favorite:${profileId}:${cardId}`; }
  function loadReaderMeta(cardId: string) {
    try {
      setReaderNote(window.localStorage.getItem(readerStorageKey(cardId)) || '');
      setReaderFavorite(window.localStorage.getItem(favoriteStorageKey(cardId)) === '1');
    } catch {
      setReaderNote('');
      setReaderFavorite(false);
    }
  }
  function saveReaderNote(cardId: string, value: string) {
    setReaderNote(value);
    try { value.trim() ? window.localStorage.setItem(readerStorageKey(cardId), value) : window.localStorage.removeItem(readerStorageKey(cardId)); } catch { /* local-only */ }
  }
  function toggleFavorite(cardId: string) {
    const next = !readerFavorite;
    try {
      next ? window.localStorage.setItem(favoriteStorageKey(cardId), '1') : window.localStorage.removeItem(favoriteStorageKey(cardId));
      setReaderFavorite(next);
      setFavoriteVersion((version) => version + 1);
    } catch { setLoadError('Não foi possível salvar o favorito neste dispositivo.'); }
  }

  function openReader(topicId: string, startIndex = 0) {
    const cards = cardsByTopic.get(topicId) ?? [];
    if (!cards.length) return;
    const nextIndex = Math.min(Math.max(startIndex, 0), cards.length - 1);
    setReader({ topicId, index: nextIndex });
    loadReaderMeta(cards[nextIndex].id);
  }

  function beginFlashcard(card: CardRow, topic: TopicRow) {
    const deck = decks.find((entry) => entry.id === card.deck_id && entry.subject_id === topic.subject_id) || decks.find((entry) => entry.subject_id === topic.subject_id);
    if (!deck) { setDraftStatus('Nenhum baralho desta disciplina está disponível.'); return; }
    setDraftStatus('');
    setDraft({
      deckId: deck.id, subjectId: topic.subject_id, topicId: topic.id,
      front: '', back: card.back, legalBasis: card.legal_basis || topic.legal_basis || '',
      source: 'Criação manual a partir da Lei Seca: ' + card.front,
      cardType: 'Pergunta e resposta', tags: ['lei-seca', 'criação-manual'],
    });
  }
  async function saveFlashcard() {
    if (!draft || draftBusy || !draft.front.trim() || !draft.back.trim()) return;
    setDraftBusy(true); setDraftStatus('');
    try {
      await createCard(getSupabaseClient(), user, profileId, draft);
      setDraft(null);
      setDraftStatus('Flashcard criado no baralho da disciplina.');
      setStudyTopicIds((ids) => new Set([...ids, draft.topicId!]));
    } catch (cause) {
      setDraftStatus(cause instanceof Error && cause.message === 'card-duplicate'
        ? 'Já existe um cartão com esta pergunta e resposta na disciplina.'
        : 'Não foi possível salvar. Confira a conexão e tente novamente.');
    } finally { setDraftBusy(false); }
  }
  function closeReader() {
    if (draftBusy) return;
    setDraft(null); setDraftStatus('');
    setReader(null);
  }

  function moveReader(delta: number) {
    if (draft || draftBusy) return;
    setDraftStatus('');
    setReader((current) => {
      if (!current) return current;
      const cards = cardsByTopic.get(current.topicId) ?? [];
      if (!cards.length) return null;
      const nextIndex = (current.index + delta + cards.length) % cards.length;
      loadReaderMeta(cards[nextIndex].id);
      return { ...current, index: nextIndex };
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
    <div className="page-wrap lei-seca-page">
      <PageHeader
        eyebrow="LEI SECA"
        title="Leitura de Lei Seca"
        subtitle="Roteiros indicam o que ler; não são o texto integral da lei. Consulte a fonte oficial ou importe trechos e registre a leitura."
        action={
          <div className="lei-seca-header-actions">
            <div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar norma ou assunto" /></div>
            <button type="button" className={`missing-toggle ${onlyMissing ? 'active' : ''}`} onClick={() => { setShowFavorites(false); setOnlyMissing((current) => !current); }}>
              {onlyMissing ? '✓ ' : ''}Sem Lei Seca
            </button>
            <button type="button" className={`missing-toggle ${onlyUnread ? 'active' : ''}`} onClick={() => setOnlyUnread((current) => !current)}>
              {onlyUnread ? '✓ ' : ''}Não lidos
            </button>
            <button type="button" className={`missing-toggle ${showFavorites ? 'active' : ''}`} aria-pressed={showFavorites} onClick={() => { setOnlyMissing(false); setShowFavorites((value) => !value); }}>★ Favoritos ({favoriteCards.length})</button>
          </div>
        }
      />
      {loadError ? <div className="notice error"><strong>Não foi possível carregar a Lei Seca.</strong><span>{loadError}</span><button onClick={() => void reloadCards()}>Tentar novamente</button></div> : null}
      <div className="dashboard-grid lei-seca-metrics">
        <MetricTile label="Assuntos com Lei Seca" value={`${coverage.coveredTopics}/${coverage.totalTopics}`} helper="do total de assuntos com base legal" />
        <MetricTile label="Disciplinas iniciadas" value={`${coverage.subjectsCovered}/${coverage.totalSubjects}`} helper="com ao menos 1 assunto cadastrado" />
        <MetricTile label="Cartões de Lei Seca" value={coverage.totalCards} helper="roteiros e trechos; confira a origem" />
        <MetricTile label="Trechos lidos" value={`${coverage.readCards}/${coverage.totalCards}`} helper="marcados como lidos" />
        <MetricTile label="Cobertura geral" value={coverage.totalTopics ? `${Math.round((coverage.coveredTopics / coverage.totalTopics) * 100)}%` : '0%'} helper="dos assuntos com roteiro ou trecho vinculado" />
      </div>
      {showFavorites ? (
        <section className="law-favorites-list" aria-label="Trechos favoritos neste dispositivo">
          <p>Favoritos salvos neste dispositivo. A busca e o filtro Não lidos também se aplicam.</p>
          {!favoriteCards.length ? <div className="study-empty">Nenhum favorito corresponde aos filtros.</div> : favoriteCards.map(({ card, topicId, index }) => (
            <button type="button" className="law-favorites-item" key={card.id} onClick={() => openReader(topicId, index)}>
              <strong>{card.front}</strong><small>{topics.find((topic) => topic.id === topicId)?.name}</small><span>{card.read_at ? 'Lido' : 'Não lido'} · Abrir →</span>
            </button>
          ))}
        </section>
      ) : !rows.length ? (
        <div className="study-empty">
          <strong>{onlyMissing ? 'Tudo coberto por aqui! 🎉' : 'Nenhum artigo cadastrado ainda.'}</strong>
          <span>{onlyMissing ? 'Todos os assuntos com base legal já têm ao menos um trecho de Lei Seca.' : 'Quando os assuntos tiverem base legal registrada, eles aparecerão aqui por matéria.'}</span>
        </div>
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
                  <span className="subject-title">
                    <strong>{subject.name}</strong>
                    <small>{onlyMissing
                      ? `${subject.rootTopics.length} assunto${subject.rootTopics.length === 1 ? '' : 's'} sem Lei Seca`
                      : `${subject.rootTopics.length} assunto${subject.rootTopics.length === 1 ? '' : 's'} · ${subjectCovered} com Lei Seca`}</small>
                  </span>
                  <span className="expand-icon">{open ? '−' : '+'}</span>
                </button>
                {open ? <div className="topic-list">{subject.rootTopics.map((topic) => {
                  const topicCards = cardsByTopic.get(topic.id) ?? [];
                  const readCount = topicCards.filter((card) => card.read_at).length;
                  const readPct = topicCards.length ? Math.round((readCount / topicCards.length) * 100) : 0;
                  return (
                    <div key={topic.id} className="topic-row-wrap">
                      <div className="topic-row lei-seca-topic-row">
                        <span className="topic-check">§</span>
                        <div className="lei-seca-topic-copy">
                          <strong>{topic.name}</strong>
                          <p>{topic.legal_basis}</p>
                          {topicCards.length ? (
                            <div className="lei-seca-topic-progress">
                              <div><span style={{ width: `${readPct}%` }} /></div>
                              <small>{readCount}/{topicCards.length} lidos · {readPct}%</small>
                            </div>
                          ) : null}
                        </div>
                        {topic.priority ? <span className={`priority-pill priority-${topic.priority.toLowerCase()}`}>Prioridade {topic.priority}</span> : null}
                      </div>
                      <div className="topic-actions lei-seca-topic-actions">
                        {topicCards.length ? (
                          <button className="primary-action" onClick={() => {
                            const firstUnread = topicCards.findIndex((card) => !card.read_at);
                            openReader(topic.id, firstUnread >= 0 ? firstUnread : 0);
                          }}>Ler agora</button>
                        ) : null}
                        {studyTopicIds.has(topic.id) ? (
                          <button className="secondary-outline" onClick={() => onStudyTopic(subject.id, topic.id)}>Estudar assunto</button>
                        ) : null}
                        <button className="secondary-outline" onClick={() => openImport(topic.id)}>Importar PDF</button>
                      </div>
                    </div>
                  );
                })}</div> : null}
              </section>
            );
          })}
        </div>
      )}

      {reader ? (() => {
        const topic = topics.find((entry) => entry.id === reader.topicId);
        const subject = topic ? subjects.find((entry) => entry.id === topic.subject_id) : null;
        const cards = cardsByTopic.get(reader.topicId) ?? [];
        const card = cards[reader.index];
        if (!topic || !card) return null;
        const readCount = cards.filter((entry) => entry.read_at).length;
        const pct = cards.length ? Math.round((readCount / cards.length) * 100) : 0;
        return (
          <div className="law-reader-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeReader()}>
            <section className={`law-reader${immersive ? ' law-reader-immersive' : ''}`} role="dialog" aria-modal="true" aria-label={`Leitura de ${topic.name}`}>
              <header className="law-reader-header">
                <div>
                  <span className="page-eyebrow">{subject?.name || 'LEI SECA'}</span>
                  <h2>{topic.name}</h2>
                  <p>{topic.legal_basis}</p>
                </div>
                <button className="law-reader-close" onClick={closeReader} aria-label="Fechar leitura">×</button>
              </header>

              <div className="law-reader-progress">
                <div><span style={{ width: `${pct}%` }} /></div>
                <small>Trecho {reader.index + 1} de {cards.length} · {readCount} lidos · {pct}% concluído</small>
              </div>

              <div className="law-reader-controls" aria-label="Opções de leitura">
                <button type="button" className="secondary-outline" disabled={readerFont <= 16} onClick={() => setReaderFont((size) => Math.max(16, size - 2))} aria-label="Diminuir fonte">A−</button>
                <span aria-live="polite">{readerFont}px</span>
                <button type="button" className="secondary-outline" disabled={readerFont >= 29} onClick={() => setReaderFont((size) => Math.min(29, size + 2))} aria-label="Aumentar fonte">A+</button>
                <button type="button" className="secondary-outline" disabled={!!draft || draftBusy} aria-pressed={immersive} onClick={() => setImmersive((value) => !value)}>{immersive ? 'Mostrar anotações' : 'Leitura focada'}</button>
                <button type="button" className="secondary-outline" aria-pressed={highlights} onClick={() => setHighlights((value) => !value)}>{highlights ? 'Ocultar destaques' : 'Destacar expressões'}</button>
              </div>
              {highlights ? <div className="law-highlight-legend"><small>Indícios por palavras-chave; não substituem a interpretação jurídica.</small><div>{Object.entries(LAW_HIGHLIGHT_LABELS).map(([kind, label]) => <span key={kind} className={'law-highlight law-highlight-' + kind}>{label}</span>)}</div></div> : null}
              <article key={card.id} className={`law-reader-paper ${card.read_at ? 'is-read' : ''}`}>
                <div className="law-reader-citation">
                  <span>{card.front}</span>
                  <button className={`law-favorite ${readerFavorite ? 'active' : ''}`} onClick={() => toggleFavorite(card.id)} aria-label={readerFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>{readerFavorite ? '★' : '☆'}</button>
                </div>
                <div className="law-reader-text" style={{ fontSize: readerFont }}>{card.back.split(/(?<=\n)/).map((line, index) => <span key={index} className={`law-block ${/^\s*(?:Art\.\s*\d|§\s*\d|Parágrafo único)/i.test(line) ? 'law-block-heading' : /^\s*[IVXLCDM]+\s*[-–—]/.test(line) ? 'law-block-inciso' : /^\s*[a-z]\)/.test(line) ? 'law-block-alinea' : ''}`}>{highlights ? highlightLawText(line).map((segment, i) => segment.kind ? <mark key={i} className={'law-highlight law-highlight-' + segment.kind} title={LAW_HIGHLIGHT_LABELS[segment.kind]}>{segment.text}</mark> : <span key={i}>{segment.text}</span>) : line}</span>)}</div>
                {!immersive && card.complement ? <aside className="law-reader-note"><strong>Observação</strong><p>{card.complement}</p></aside> : null}
                {!immersive ? <label className="law-personal-note"><strong>Minha anotação neste dispositivo</strong><textarea rows={3} value={readerNote} onChange={(event) => saveReaderNote(card.id, event.target.value)} placeholder="Escreva uma observação, exceção ou macete pessoal…" /></label> : null}
                {!immersive ? <div className="law-flashcard-editor">
                  {!draft ? <button type="button" className="secondary-outline" onClick={() => beginFlashcard(card, topic)}>+ Criar flashcard deste trecho</button> : <>
                    <strong>Novo flashcard de revisão</strong>
                    <small>Edite a pergunta e a resposta. O trecho de origem não será alterado.</small>
                    <label>Pergunta<textarea rows={2} value={draft.front} disabled={draftBusy} onChange={(event) => setDraft({ ...draft, front: event.target.value })} placeholder="O que devo lembrar deste dispositivo?" /></label>
                    <label>Resposta<textarea rows={5} value={draft.back} disabled={draftBusy} onChange={(event) => setDraft({ ...draft, back: event.target.value })} /></label>
                    <label>Fundamento legal<input value={draft.legalBasis || ''} disabled={draftBusy} onChange={(event) => setDraft({ ...draft, legalBasis: event.target.value })} /></label>
                    <div className="law-flashcard-actions">
                      <button type="button" className="secondary-outline" disabled={draftBusy} onClick={() => { setDraft(null); setDraftStatus(''); }}>Cancelar</button>
                      <button type="button" className="primary-action" disabled={draftBusy || !draft.front.trim() || !draft.back.trim()} onClick={() => void saveFlashcard()}>{draftBusy ? 'Salvando…' : 'Salvar flashcard'}</button>
                    </div>
                  </>}
                  {draftStatus ? <p role="status">{draftStatus}</p> : null}
                </div> : null}
              </article>

              <footer className="law-reader-footer">
                <button className="secondary-outline" onClick={() => moveReader(-1)} disabled={cards.length < 2 || !!draft || draftBusy}>← Anterior</button>
                <button className={`read-toggle law-reader-read ${card.read_at ? 'is-read' : ''}`} onClick={() => toggleRead(card)}>{card.read_at ? '✓ Lido' : 'Marcar como lido'}</button>
                <button className="primary-action" onClick={() => moveReader(1)} disabled={cards.length < 2 || !!draft || draftBusy}>Próximo →</button>
              </footer>
            </section>
          </div>
        );
      })() : null}
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
