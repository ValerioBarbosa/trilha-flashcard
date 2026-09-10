import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import {
  listCards,
  listLatestReviewsByCard,
  listOpenErrorCardIds,
  saveReview,
  type CardRow,
  type LatestReview,
} from './domain-repository';
import { buildStudyQueue, SCOPE_LABEL, type Scope } from './study-queue';
import { PageHeader } from '../shared/PageHeader';

type StudyTopic = { id: string; subject_id: string; parent_id: string | null; name: string };
type StudyDeck = { id: string; name: string; subject_id: string | null };

export function StudyPage({ user, profileId, subjects, topics, decks }: { user: User; profileId: string; subjects: Array<{ id: string; name: string }>; topics: StudyTopic[]; decks: StudyDeck[] }) {
  const firstSubjectWithDeck = subjects.find((subject) => decks.some((deck) => deck.subject_id === subject.id));
  const [subjectId, setSubjectId] = useState(firstSubjectWithDeck?.id || 'all');
  const [topicId, setTopicId] = useState('all');
  const [subtopicId, setSubtopicId] = useState('all');
  const [loadedCards, setLoadedCards] = useState<CardRow[]>([]);
  const [reviewMap, setReviewMap] = useState<Map<string, LatestReview>>(new Map());
  const [errorCardIds, setErrorCardIds] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  const [session, setSession] = useState<CardRow[] | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('due');
  const [priority, setPriority] = useState<'' | 'A' | 'B' | 'C'>('');
  const [count, setCount] = useState(20);

  const subjectDecks = useMemo(() => decks.filter((deck) => deck.subject_id && (subjectId === 'all' || deck.subject_id === subjectId)), [decks, subjectId]);
  const availableTopics = useMemo(() => topics.filter((topic) => topic.subject_id === subjectId && !topic.parent_id), [topics, subjectId]);
  const availableSubtopics = useMemo(() => topics.filter((topic) => topic.parent_id === topicId), [topics, topicId]);
  const childTopicIds = useMemo(() => new Set(topics.filter((topic) => topic.parent_id === topicId).map((topic) => topic.id)), [topics, topicId]);

  const filteredCards = useMemo(() => loadedCards.filter((card) => {
    if (subtopicId !== 'all') return card.topic_id === subtopicId;
    if (topicId !== 'all') return card.topic_id === topicId || Boolean(card.topic_id && childTopicIds.has(card.topic_id));
    return true;
  }), [loadedCards, topicId, subtopicId, childTopicIds]);

  const cards = session ?? filteredCards;

  async function refreshReviewState() {
    const [reviews, errors] = await Promise.all([
      listLatestReviewsByCard(getSupabaseClient(), profileId),
      listOpenErrorCardIds(getSupabaseClient(), profileId),
    ]);
    setReviewMap(reviews);
    setErrorCardIds(errors);
  }

  useEffect(() => {
    setTopicId('all');
    setSubtopicId('all');
  }, [subjectId]);

  useEffect(() => {
    setSubtopicId('all');
  }, [topicId]);

  useEffect(() => {
    setSession(null);
    if (!subjectDecks.length) { setLoadedCards([]); return; }
    setLoading(true);
    setMessage(null);
    void Promise.all([
      Promise.all(subjectDecks.map((deck) => listCards(getSupabaseClient(), deck.id))),
      refreshReviewState(),
    ])
      .then(([groups]) => {
        const unique = new Map<string, CardRow>();
        groups.flat().forEach((card) => unique.set(card.id, card));
        setLoadedCards([...unique.values()]);
        setIndex(0);
        setRevealed(false);
        setStartedAt(Date.now());
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [subjectDecks]);

  useEffect(() => {
    setIndex(0);
    setRevealed(false);
    setStartedAt(Date.now());
  }, [topicId, subtopicId]);

  const card = cards[index];

  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!card) return;
    setMessage(null);
    try {
      await saveReview(getSupabaseClient(), user, profileId, card.id, rating, Date.now() - startedAt);
      setMessage('Revisão registrada.');
      const next = cards.length ? (index + 1) % cards.length : 0;
      setIndex(next);
      setRevealed(false);
      setStartedAt(Date.now());
      void refreshReviewState();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function buildSession() {
    const picked = buildStudyQueue(filteredCards, reviewMap, errorCardIds, { scope, priority, count });
    if (!picked.length) {
      setMessage('Nenhum cartão corresponde a esse filtro.');
      return;
    }
    setSession(picked);
    setIndex(0);
    setRevealed(false);
    setStartedAt(Date.now());
    setMessage(`Sessão iniciada com ${picked.length} cartões.`);
    setBuilderOpen(false);
  }

  function exitSession() {
    setSession(null);
    setIndex(0);
    setRevealed(false);
    setStartedAt(Date.now());
  }

  function goPrevious() {
    if (!cards.length) return;
    setIndex((current) => (current - 1 + cards.length) % cards.length);
    setRevealed(false);
    setStartedAt(Date.now());
  }

  function goNext() {
    if (!cards.length) return;
    setIndex((current) => (current + 1) % cards.length);
    setRevealed(false);
    setStartedAt(Date.now());
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const tag = (target as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    }

    function onKeyDown(event: KeyboardEvent) {
      if (builderOpen || isTypingTarget(event.target)) return;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        setRevealed((current) => !current);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [builderOpen, cards.length]);

  return (
    <div className="page-wrap study-page">
      <PageHeader eyebrow="SESSÃO DE ESTUDO" title="Estudar" subtitle="Recupere a resposta antes de revelar. Depois, registre o nível de lembrança." />
      <div className="study-toolbar study-filter-toolbar">
        <label><span>Disciplina</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={Boolean(session)}><option value="all">Todas</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label><span>Assunto</span><select value={topicId} onChange={(event) => setTopicId(event.target.value)} disabled={subjectId === 'all' || Boolean(session)}><option value="all">Todos os assuntos</option>{availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <label><span>Subassunto</span><select value={subtopicId} onChange={(event) => setSubtopicId(event.target.value)} disabled={topicId === 'all' || availableSubtopics.length === 0 || Boolean(session)}><option value="all">Todos os subassuntos</option>{availableSubtopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <div className="session-counter"><span>Progresso</span><strong>{cards.length ? `${index + 1}/${cards.length}` : '0/0'}</strong></div>
      </div>
      <div className="study-session-bar">
        {session ? (
          <><span className="import-status">Sessão personalizada em andamento · {cards.length} cartões</span><button className="secondary-outline" onClick={exitSession}>Sair da sessão</button></>
        ) : (
          <button className="secondary-outline" onClick={() => setBuilderOpen(true)}>Montar sessão</button>
        )}
        <small className="keyboard-hint">Espaço vira o cartão · ← → navega</small>
      </div>
      {loading ? <div className="study-empty">Carregando cartões…</div> : !card ? <div className="study-empty"><strong>Nenhum cartão neste filtro.</strong><span>Escolha outra disciplina, assunto ou subassunto.</span></div> : <><button className={`flashcard-modern ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(true)}><div className="card-meta"><span>{card.priority ? `Prioridade ${card.priority}` : 'Flashcard'}</span>{card.tags?.[0] ? <span>{card.tags[0]}</span> : null}</div><div className="card-question"><small>PERGUNTA</small><h2>{card.front}</h2></div>{revealed ? <div className="card-answer"><small>RESPOSTA</small><p>{card.back}</p>{card.legal_basis ? <div className="legal-basis"><strong>Base legal</strong><span>{card.legal_basis}</span></div> : null}{card.pitfall ? <div className="pitfall"><strong>Pegadinha</strong><span>{card.pitfall}</span></div> : null}{card.mnemonic ? <div className="mnemonic"><strong>Mnemônico</strong><span>{card.mnemonic}</span></div> : null}</div> : <div className="reveal-hint">Toque no cartão para revelar</div>}</button>{revealed ? <div className="rating-row"><button className="rating again" onClick={() => void rate(1)}><strong>Errei</strong><span>rever logo</span></button><button className="rating hard" onClick={() => void rate(2)}><strong>Difícil</strong><span>1 dia</span></button><button className="rating good" onClick={() => void rate(3)}><strong>Bom</strong><span>7 dias</span></button><button className="rating easy" onClick={() => void rate(4)}><strong>Fácil</strong><span>30 dias</span></button></div> : null}<div className="study-navigation"><button className="secondary-action" onClick={goPrevious}>← Anterior</button><button className="secondary-action" onClick={goNext}>Próximo →</button></div></>}
      {message ? <p className="toast-note">{message}</p> : null}

      {builderOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBuilderOpen(false)}><div className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="page-eyebrow">SESSÃO PERSONALIZADA</span><h2>Montar sessão</h2><p>Filtra, embaralha e limita os cartões da disciplina/assunto já selecionados acima.</p></div><button className="modal-close" onClick={() => setBuilderOpen(false)}>×</button></div>
        <div className="form-grid">
          <label><span>Escopo</span><select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>{(Object.keys(SCOPE_LABEL) as Scope[]).map((key) => <option key={key} value={key}>{SCOPE_LABEL[key]}</option>)}</select></label>
          <label><span>Prioridade</span><select value={priority} onChange={(event) => setPriority(event.target.value as '' | 'A' | 'B' | 'C')}><option value="">Todas</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
          <label className="full"><span>Quantidade de cartões</span><input type="number" min={1} max={200} value={count} onChange={(event) => setCount(Number(event.target.value) || 1)} /></label>
        </div>
        <div className="modal-actions"><button className="secondary-outline" onClick={() => setBuilderOpen(false)}>Cancelar</button><button className="primary-action" onClick={buildSession}>Iniciar sessão</button></div>
      </div></div> : null}
    </div>
  );
}
