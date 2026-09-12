import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
import { listCardsByType, listStudyCardCountsByTopic } from '../study/domain-repository';
import { EditalPage } from '../edital/EditalPage';
import { LeiSecaPage } from '../edital/LeiSecaPage';
import { JurisprudencePage } from '../jurisprudence/JurisprudencePage';
import { PerformancePage } from '../performance/PerformancePage';
import { getSupabaseClient } from '../lib/supabase-client';
import { BackupPanel } from '../data/BackupPanel';
import { LegacyMigrationPanel } from '../migration/LegacyMigrationPanel';
import { MetricTile } from '../shared/MetricTile';
import { PageHeader } from '../shared/PageHeader';
import { SyncPanel } from '../sync/SyncPanel';
import { ProfileSwitcher } from '../study/ProfileSwitcher';
import { StudyPage, type StudyFocus } from '../study/StudyPage';
import { useStudyWorkspace } from '../study/useStudyWorkspace';
import { ThemeToggle } from '../shared/ThemeToggle';

type PageId = 'home' | 'study' | 'edital' | 'jurisprudence' | 'lei-seca' | 'performance' | 'data';

type Props = {
  user: User;
  onSignOut: () => Promise<void>;
};

const NAV: Array<{ id: PageId; label: string; icon: string }> = [
  { id: 'home', label: 'Início', icon: '⌂' },
  { id: 'study', label: 'Estudar', icon: '▣' },
  { id: 'edital', label: 'Edital', icon: '☑' },
  { id: 'jurisprudence', label: 'Jurisprudência', icon: '§' },
  { id: 'lei-seca', label: 'Lei Seca', icon: '⚖' },
  { id: 'performance', label: 'Desempenho', icon: '↗' },
  { id: 'data', label: 'Dados', icon: '↻' },
];

export function ModernWorkspace({ user, onSignOut }: Props) {
  const workspace = useStudyWorkspace(user);
  const [page, setPage] = useState<PageId>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [studyFocus, setStudyFocus] = useState<StudyFocus | null>(null);

  const selectPage = (next: PageId) => {
    setPage(next);
    setMenuOpen(false);
  };

  const focusStudyTopic = (subjectId: string, topicId: string) => {
    setStudyFocus({ subjectId, topicId, token: Date.now() });
    selectPage('study');
  };

  const startWrongReview = () => {
    setStudyFocus({ subjectId: 'all', topicId: 'all', token: Date.now(), scope: 'wrong' });
    selectPage('study');
  };

  const startDueReview = () => {
    setStudyFocus({ subjectId: 'all', topicId: 'all', token: Date.now(), scope: 'due' });
    selectPage('study');
  };

  return (
    <div className="modern-app">
      <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand-block"><span className="brand-mark">T</span><div><strong>Trilha</strong><small>Concursos</small></div></div>
        <nav className="app-nav" aria-label="Navegação principal">
          {NAV.map((item) => <button type="button" key={item.id} className={page === item.id ? 'active' : ''} onClick={() => selectPage(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-footer">
          <ThemeToggle />
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
            {page === 'home' ? <HomePage user={user} workspace={workspace} onNavigate={selectPage} onStudySubject={(subjectId) => focusStudyTopic(subjectId, 'all')} onReviewDue={startDueReview} /> : null}
            {page === 'study' ? <StudyPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} decks={workspace.decks} focus={studyFocus} /> : null}
            {page === 'edital' ? <EditalPage profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} onStudyTopic={focusStudyTopic} /> : null}
            {page === 'jurisprudence' ? <JurisprudencePage profileId={workspace.profile.id} /> : null}
            {page === 'lei-seca' ? <LeiSecaPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} decks={workspace.decks} onStudyTopic={focusStudyTopic} /> : null}
            {page === 'performance' ? <PerformancePage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} onReviewWrong={startWrongReview} onReviewDue={startDueReview} /> : null}
            {page === 'data' ? <DataPage user={user} workspace={workspace} onMigrated={workspace.refresh} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function LoadingView({ seeding }: { seeding: boolean }) {
  return <div className="page-wrap loading-page"><div className="loading-orb" /><h2>{seeding ? 'Preparando seus baralhos…' : 'Carregando sua trilha…'}</h2><p>{seeding ? 'O catálogo oficial está sendo organizado no novo banco. Isso acontece apenas na primeira vez.' : 'Sincronizando estrutura e progresso.'}</p></div>;
}

function HomePage({ user, workspace, onNavigate, onStudySubject, onReviewDue }: {
  user: User;
  workspace: ReturnType<typeof useStudyWorkspace>;
  onNavigate: (page: PageId) => void;
  onStudySubject: (subjectId: string) => void;
  onReviewDue: () => void;
}) {
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [leiSecaCount, setLeiSecaCount] = useState(0);
  const [editalCoveredTopics, setEditalCoveredTopics] = useState(0);
  const [leiSecaCoveredTopics, setLeiSecaCoveredTopics] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    const profileId = workspace.profile!.id;
    setLoadError(null);
    void Promise.all([
      loadPerformance(client, user, profileId),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).is('deleted_at', null).eq('suspended', false).or('card_type.is.null,card_type.neq.Lei seca'),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).is('deleted_at', null).eq('suspended', false).eq('card_type', 'Lei seca'),
      listStudyCardCountsByTopic(client, profileId),
      listCardsByType(client, profileId, 'Lei seca'),
    ]).then(([summary, cards, leiSeca, studyCounts, leiSecaCards]) => {
      setPerformance(summary);
      if (!cards.error) setCardCount(cards.count ?? 0);
      if (!leiSeca.error) setLeiSecaCount(leiSeca.count ?? 0);
      setEditalCoveredTopics(studyCounts.size);
      setLeiSecaCoveredTopics(new Set(leiSecaCards.map((card) => card.topic_id).filter(Boolean)).size);
    }).catch((cause) => setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados do painel.'));
  }, [user.id, workspace.profile?.id]);

  const rootTopics = workspace.topics.filter((topic) => !topic.parent_id);
  const leiSecaEligibleTopics = rootTopics.filter((topic) => topic.legal_basis && workspace.subjects.find((subject) => subject.id === topic.subject_id)?.name.trim().toLowerCase() !== 'português');
  const editalPct = rootTopics.length ? Math.round((editalCoveredTopics / rootTopics.length) * 100) : 0;
  const leiSecaPct = leiSecaEligibleTopics.length ? Math.round((leiSecaCoveredTopics / leiSecaEligibleTopics.length) * 100) : 0;

  const topDecks = workspace.decks.filter((deck) => deck.subject_id).slice(0, 4);

  const heroAction = () => (performance?.dueNow ? onReviewDue() : onNavigate('study'));
  const heroLabel = performance?.dueNow ? `Revisar ${performance.dueNow} vencido${performance.dueNow === 1 ? '' : 's'} →` : 'Continuar estudando →';

  const focusMessage = performance?.dueNow
    ? { title: `${performance.dueNow} cartão${performance.dueNow === 1 ? '' : 's'} vencido${performance.dueNow === 1 ? '' : 's'}.`, body: 'A revisão espaçada funciona melhor sem atraso — vale zerar a fila agora.', action: 'Revisar agora', onClick: onReviewDue }
    : leiSecaPct < editalPct
      ? { title: 'Lei Seca está para trás.', body: `Cobertura de Lei Seca em ${leiSecaPct}%, contra ${editalPct}% de flashcards. Bom momento pra importar mais PDFs.`, action: 'Abrir Lei Seca', onClick: () => onNavigate('lei-seca') }
      : { title: 'Continue no Edital.', body: `${editalPct}% dos assuntos já têm flashcard. Use o Edital pra achar o que falta cadastrar.`, action: 'Abrir edital', onClick: () => onNavigate('edital') };

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="SEU PAINEL" title={`Bom estudo${user.user_metadata?.given_name ? `, ${user.user_metadata.given_name}` : ''}.`} subtitle={`${workspace.profile?.name} · ${workspace.profile?.board || 'Banca em acompanhamento'} · Edital ${workspace.profile?.edital_year || 'atual'}`} action={<button className="primary-action" onClick={heroAction}>{heroLabel}</button>} />
      {loadError ? <div className="notice error"><strong>Alguns dados não carregaram.</strong><span>{loadError}</span></div> : null}
      <section className="hero-study-card"><div><span className="hero-kicker">PRÓXIMA AÇÃO</span><h2>Transforme pendências em pontos.</h2><p>Estude um baralho, responda sem revelar e registre a dificuldade. O desempenho passa a alimentar sua trilha.</p><button onClick={heroAction}>{performance?.dueNow ? 'Revisar vencidos' : 'Iniciar sessão'}</button></div><div className="hero-stat"><strong>{performance?.streakDays ?? 0}</strong><span>dia{performance?.streakDays === 1 ? '' : 's'} seguidos</span></div></section>
      <div className="dashboard-grid lei-seca-metrics">
        <MetricTile label="Flashcards" value={cardCount} helper={`${editalPct}% do edital coberto`} />
        <MetricTile label="Trechos de Lei Seca" value={leiSecaCount} helper={`${leiSecaPct}% dos assuntos cobertos`} />
        <MetricTile label="Precisão" value={`${performance?.accuracy ?? 0}%`} helper={`${performance?.totalReviews ?? 0} revisões`} />
        <MetricTile label="Revisar hoje" value={performance?.dueNow ?? 0} helper="cartões vencidos" />
        <MetricTile label="Erros abertos" value={performance?.openErrors ?? 0} helper="para atacar na revisão" />
      </div>
      <div className="content-grid two-one">
        <section className="panel-card"><div className="panel-heading"><div><span>BARALHOS</span><h2>Continuar por disciplina</h2></div><button className="link-button" onClick={() => onNavigate('study')}>Ver todos</button></div><div className="deck-list-clean">{topDecks.map((deck, index) => <button key={deck.id} onClick={() => onStudySubject(deck.subject_id!)}><span className="deck-number">{String(index + 1).padStart(2, '0')}</span><span className="deck-copy"><strong>{deck.name}</strong><small>{deck.is_builtin ? 'Baralho oficial' : 'Baralho personalizado'}</small></span><span className="chevron">›</span></button>)}</div></section>
        <section className="panel-card accent-panel"><span className="panel-label">PRÓXIMO FOCO</span><h2>{focusMessage.title}</h2><p>{focusMessage.body}</p><button onClick={focusMessage.onClick}>{focusMessage.action}</button></section>
      </div>
    </div>
  );
}


function DataPage({ user, workspace, onMigrated }: { user: User; workspace: ReturnType<typeof useStudyWorkspace>; onMigrated: () => Promise<void> }) {
  return <div className="page-wrap"><PageHeader eyebrow="CONTA E DADOS" title="Sincronização" subtitle="Migre o legado, confira a nuvem e mantenha uma cópia local durante a transição." /><ProfileSwitcher profiles={workspace.profiles} activeProfileId={workspace.profile?.id ?? null} onSwitch={workspace.switchProfile} onCreate={workspace.createProfile} /><BackupPanel user={user} profile={workspace.profile ? { id: workspace.profile.id, name: workspace.profile.name, slug: workspace.profile.slug } : null} onRestored={onMigrated} /><LegacyMigrationPanel user={user} onMigrated={onMigrated} /><SyncPanel user={user} /></div>;
}
