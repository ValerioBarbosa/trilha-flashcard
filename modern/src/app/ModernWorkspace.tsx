import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
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
            {page === 'home' ? <HomePage user={user} workspace={workspace} onNavigate={selectPage} /> : null}
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

  const topDecks = workspace.decks.filter((deck) => deck.subject_id).slice(0, 4);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="SEU PAINEL" title={`Bom estudo${user.user_metadata?.given_name ? `, ${user.user_metadata.given_name}` : ''}.`} subtitle={`${workspace.profile?.name} · ${workspace.profile?.board || 'Banca em acompanhamento'} · Edital ${workspace.profile?.edital_year || 'atual'}`} action={<button className="primary-action" onClick={() => onNavigate('study')}>Continuar estudando →</button>} />
      <section className="hero-study-card"><div><span className="hero-kicker">PRÓXIMA AÇÃO</span><h2>Transforme pendências em pontos.</h2><p>Estude um baralho, responda sem revelar e registre a dificuldade. O desempenho passa a alimentar sua trilha.</p><button onClick={() => onNavigate('study')}>Iniciar sessão</button></div><div className="hero-stat"><strong>{performance?.reviewedToday ?? 0}</strong><span>revisões hoje</span></div></section>
      <div className="dashboard-grid four"><MetricTile label="Cartões ativos" value={cardCount} helper="No perfil atual" /><MetricTile label="Precisão" value={`${performance?.accuracy ?? 0}%`} helper={`${performance?.totalReviews ?? 0} revisões`} /><MetricTile label="Disciplinas" value={workspace.subjects.length} helper="Organizadas pelo edital" /><MetricTile label="Erros abertos" value={performance?.openErrors ?? 0} helper="Para atacar na revisão" /></div>
      <div className="content-grid two-one">
        <section className="panel-card"><div className="panel-heading"><div><span>BARALHOS</span><h2>Continuar por disciplina</h2></div><button className="link-button" onClick={() => onNavigate('study')}>Ver todos</button></div><div className="deck-list-clean">{topDecks.map((deck, index) => <button key={deck.id} onClick={() => onNavigate('study')}><span className="deck-number">{String(index + 1).padStart(2, '0')}</span><span className="deck-copy"><strong>{deck.name}</strong><small>{deck.is_builtin ? 'Baralho oficial' : 'Baralho personalizado'}</small></span><span className="chevron">›</span></button>)}</div></section>
        <section className="panel-card accent-panel"><span className="panel-label">FOCO DA SEMANA</span><h2>Lei seca + revisão espaçada.</h2><p>Use o Edital para escolher o tópico e volte ao cartão para reforçar a memorização.</p><button onClick={() => onNavigate('edital')}>Abrir edital</button></section>
      </div>
    </div>
  );
}


function DataPage({ user, workspace, onMigrated }: { user: User; workspace: ReturnType<typeof useStudyWorkspace>; onMigrated: () => Promise<void> }) {
  return <div className="page-wrap"><PageHeader eyebrow="CONTA E DADOS" title="Sincronização" subtitle="Migre o legado, confira a nuvem e mantenha uma cópia local durante a transição." /><ProfileSwitcher profiles={workspace.profiles} activeProfileId={workspace.profile?.id ?? null} onSwitch={workspace.switchProfile} onCreate={workspace.createProfile} /><BackupPanel user={user} profile={workspace.profile ? { id: workspace.profile.id, name: workspace.profile.name, slug: workspace.profile.slug } : null} onRestored={onMigrated} /><LegacyMigrationPanel user={user} onMigrated={onMigrated} /><SyncPanel user={user} /></div>;
}
