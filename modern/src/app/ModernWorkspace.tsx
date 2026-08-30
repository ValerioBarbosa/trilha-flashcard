import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
import { listCards, saveReview, type CardRow } from '../study/domain-repository';
import { EditalPage } from '../edital/EditalPage';
import { JurisprudencePage } from '../jurisprudence/JurisprudencePage';
import { PerformancePage } from '../performance/PerformancePage';
import { getSupabaseClient } from '../lib/supabase-client';
import { LegacyMigrationPanel } from '../migration/LegacyMigrationPanel';
import { ProductionQuestionsPage } from '../questions/ProductionQuestionsPage';
import { MetricTile } from '../shared/MetricTile';
import { PageHeader } from '../shared/PageHeader';
import { SyncPanel } from '../sync/SyncPanel';
import { useStudyWorkspace } from '../study/useStudyWorkspace';

type PageId = 'home' | 'study' | 'edital' | 'questions' | 'jurisprudence' | 'performance' | 'data';

type Props = {
  user: User;
  onSignOut: () => Promise<void>;
};

const NAV: Array<{ id: PageId; label: string; icon: string }> = [
  { id: 'home', label: 'Início', icon: '⌂' },
  { id: 'study', label: 'Estudar', icon: '▣' },
  { id: 'edital', label: 'Edital', icon: '☑' },
  { id: 'questions', label: 'Questões', icon: '?' },
  { id: 'jurisprudence', label: 'Jurisprudência', icon: '§' },
  { id: 'performance', label: 'Desempenho', icon: '↗' },
  { id: 'data', label: 'Dados', icon: '↻' },
];

export function ModernWorkspace({ user, onSignOut }: Props) {
  const workspace = useStudyWorkspace(user);
  const [page, setPage] = useState<PageId>('home');
  const [menuOpen, setMenuOpen] = useState(false);

  const selectPage = (next: PageId) => {
    setPage(next);
    setMenuOpen(false);
  };

  return (
    <div className="modern-app">
      <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand-block"><span className="brand-mark">T</span><div><strong>Trilha</strong><small>Concursos</small></div></div>
        <nav className="app-nav" aria-label="Navegação principal">
          {NAV.map((item) => <button type="button" key={item.id} className={page === item.id ? 'active' : ''} onClick={() => selectPage(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-footer">
          <div className="account-chip"><span className="account-avatar">{(user.email || 'U').slice(0, 1).toUpperCase()}</span><div><strong>{user.user_metadata?.full_name || 'Estudante'}</strong><small>{user.email}</small></div></div>
          <button type="button" className="text-button" onClick={() => void onSignOut()}>Sair</button>
        </div>
      </aside>

      {menuOpen ? <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} /> : null}

      <main className="app-main">
        <header className="mobile-topbar"><button type="button" className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button><strong>Trilha Concursos</strong></header>
        {workspace.error ? (
          <div className="page-wrap"><div className="notice error"><strong>Não foi possível carregar os estudos.</strong><span>{workspace.error}</span><button onClick={() => void workspace.refresh()}>Tentar novamente</button></div></div>
        ) : workspace.loading ? (
          <LoadingView seeding={workspace.seeding} />
        ) : !workspace.profile ? (
          <div className="page-wrap"><div className="notice">Nenhum perfil de estudos disponível.</div></div>
        ) : (
          <>
            {page === 'home' ? <HomePage user={user} workspace={workspace} onNavigate={selectPage} /> : null}
            {page === 'study' ? <StudyPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} decks={workspace.decks} /> : null}
            {page === 'edital' ? <EditalPage subjects={workspace.subjects} topics={workspace.topics} /> : null}
            {page === 'questions' ? <ProductionQuestionsPage user={user} profileId={workspace.profile.id} /> : null}
            {page === 'jurisprudence' ? <JurisprudencePage profileId={workspace.profile.id} /> : null}
            {page === 'performance' ? <PerformancePage user={user} profileId={workspace.profile.id} /> : null}
            {page === 'data' ? <DataPage user={user} onMigrated={workspace.refresh} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function LoadingView({ seeding }: { seeding: boolean }) {
  return <div className="page-wrap loading-page"><div className="loading-orb" /><h2>{seeding ? 'Preparando seus baralhos…' : 'Carregando sua trilha…'}</h2><p>{seeding ? 'O catálogo oficial está sendo organizado no novo banco. Isso acontece apenas na primeira vez.' : 'Sincronizando estrutura e progresso.'}</p></div>;
}

function HomePage({ user, workspace, onNavigate }: { user: User; workspace: ReturnType<typeof useStudyWorkspace>; onNavigate: (page: PageId) => void }) {
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [cardCount, setCardCount] = useState(0);

  useEffect(() => {
    const client = getSupabaseClient();
    void Promise.all([
      loadPerformance(client, user, workspace.profile!.id),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', workspace.profile!.id).is('deleted_at', null),
    ]).then(([summary, cards]) => {
      setPerformance(summary);
      if (!cards.error) setCardCount(cards.count ?? 0);
    }).catch(() => undefined);
  }, [user.id, workspace.profile?.id]);

  const topDecks = workspace.decks.slice(0, 4);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="SEU PAINEL" title={`Bom estudo${user.user_metadata?.given_name ? `, ${user.user_metadata.given_name}` : ''}.`} subtitle={`${workspace.profile?.name} · ${workspace.profile?.board || 'Banca em acompanhamento'} · Edital ${workspace.profile?.edital_year || 'atual'}`} action={<button className="primary-action" onClick={() => onNavigate('study')}>Continuar estudando →</button>} />
      <section className="hero-study-card"><div><span className="hero-kicker">PRÓXIMA AÇÃO</span><h2>Transforme pendências em pontos.</h2><p>Estude um baralho, responda sem revelar e registre a dificuldade. O desempenho passa a alimentar sua trilha.</p><button onClick={() => onNavigate('study')}>Iniciar sessão</button></div><div className="hero-stat"><strong>{performance?.reviewedToday ?? 0}</strong><span>revisões hoje</span></div></section>
      <div className="dashboard-grid four"><MetricTile label="Cartões ativos" value={cardCount} helper="No perfil atual" /><MetricTile label="Precisão" value={`${performance?.accuracy ?? 0}%`} helper={`${performance?.totalReviews ?? 0} revisões`} /><MetricTile label="Disciplinas" value={workspace.subjects.length} helper="Organizadas pelo edital" /><MetricTile label="Erros abertos" value={performance?.openErrors ?? 0} helper="Para atacar na revisão" /></div>
      <div className="content-grid two-one">
        <section className="panel-card"><div className="panel-heading"><div><span>BARALHOS</span><h2>Continuar por disciplina</h2></div><button className="link-button" onClick={() => onNavigate('study')}>Ver todos</button></div><div className="deck-list-clean">{topDecks.map((deck, index) => <button key={deck.id} onClick={() => onNavigate('study')}><span className="deck-number">{String(index + 1).padStart(2, '0')}</span><span className="deck-copy"><strong>{deck.name}</strong><small>{deck.is_builtin ? 'Baralho oficial' : 'Baralho personalizado'}</small></span><span className="chevron">›</span></button>)}</div></section>
        <section className="panel-card accent-panel"><span className="panel-label">FOCO DA SEMANA</span><h2>Lei seca + questões + revisão.</h2><p>Use o Edital para escolher o tópico e volte ao cartão depois da resolução de questões.</p><button onClick={() => onNavigate('edital')}>Abrir edital</button></section>
      </div>
    </div>
  );
}

function StudyPage({ user, profileId, subjects, decks }: { user: User; profileId: string; subjects: Array<{id:string;name:string}>; decks: Array<{id:string;name:string;subject_id:string|null}> }) {
  const [subjectId, setSubjectId] = useState('all');
  const filteredDecks = useMemo(() => subjectId === 'all' ? decks : decks.filter((deck) => deck.subject_id === subjectId), [decks, subjectId]);
  const [deckId, setDeckId] = useState(filteredDecks[0]?.id || '');
  const [cards, setCards] = useState<CardRow[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  useEffect(() => {
    if (!filteredDecks.some((deck) => deck.id === deckId)) setDeckId(filteredDecks[0]?.id || '');
  }, [subjectId, filteredDecks, deckId]);

  useEffect(() => {
    if (!deckId) { setCards([]); return; }
    setLoading(true);
    void listCards(getSupabaseClient(), deckId)
      .then((rows) => { setCards(rows); setIndex(0); setRevealed(false); setStartedAt(Date.now()); })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [deckId]);

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
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="page-wrap study-page">
      <PageHeader eyebrow="SESSÃO DE ESTUDO" title="Estudar" subtitle="Recupere a resposta antes de revelar. Depois, registre o nível de lembrança." />
      <div className="study-toolbar"><label><span>Disciplina</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="all">Todas</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span>Baralho</span><select value={deckId} onChange={(event) => setDeckId(event.target.value)}>{filteredDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label><div className="session-counter"><span>Progresso</span><strong>{cards.length ? `${index + 1}/${cards.length}` : '0/0'}</strong></div></div>
      {loading ? <div className="study-empty">Carregando cartões…</div> : !card ? <div className="study-empty"><strong>Nenhum cartão neste baralho.</strong><span>Importe cartões ou escolha outro baralho.</span></div> : <><button className={`flashcard-modern ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(true)}><div className="card-meta"><span>{card.priority ? `Prioridade ${card.priority}` : 'Flashcard'}</span>{card.tags?.[0] ? <span>{card.tags[0]}</span> : null}</div><div className="card-question"><small>PERGUNTA</small><h2>{card.front}</h2></div>{revealed ? <div className="card-answer"><small>RESPOSTA</small><p>{card.back}</p>{card.legal_basis ? <div className="legal-basis"><strong>Base legal</strong><span>{card.legal_basis}</span></div> : null}{card.pitfall ? <div className="pitfall"><strong>Pegadinha</strong><span>{card.pitfall}</span></div> : null}{card.mnemonic ? <div className="mnemonic"><strong>Mnemônico</strong><span>{card.mnemonic}</span></div> : null}</div> : <div className="reveal-hint">Toque no cartão para revelar</div>}</button>{revealed ? <div className="rating-row"><button className="rating again" onClick={() => void rate(1)}><strong>Errei</strong><span>rever logo</span></button><button className="rating hard" onClick={() => void rate(2)}><strong>Difícil</strong><span>1 dia</span></button><button className="rating good" onClick={() => void rate(3)}><strong>Bom</strong><span>7 dias</span></button><button className="rating easy" onClick={() => void rate(4)}><strong>Fácil</strong><span>30 dias</span></button></div> : null}<div className="study-navigation"><button className="secondary-action" onClick={() => { setIndex((index - 1 + cards.length) % cards.length); setRevealed(false); setStartedAt(Date.now()); }}>← Anterior</button><button className="secondary-action" onClick={() => { setIndex((index + 1) % cards.length); setRevealed(false); setStartedAt(Date.now()); }}>Próximo →</button></div></>}
      {message ? <p className="toast-note">{message}</p> : null}
    </div>
  );
}

function DataPage({ user, onMigrated }: { user: User; onMigrated: () => Promise<void> }) {
  return <div className="page-wrap"><PageHeader eyebrow="CONTA E DADOS" title="Sincronização" subtitle="Migre o legado, confira a nuvem e mantenha uma cópia local durante a transição." /><LegacyMigrationPanel user={user} onMigrated={onMigrated} /><SyncPanel user={user} /></div>;
}
