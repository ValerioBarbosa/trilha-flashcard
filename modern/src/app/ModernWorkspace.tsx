import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadPerformance, type PerformanceSummary } from '@core/features/performance/performance-repository';
import { listCardsByType, listOfficialEditalTopicIds } from '../study/domain-repository';
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
import { LearningPage } from '../learning/LearningPage';
import { DISCIPLINES } from '../learning/LearningPage';
import { CardManagerPage } from '../cards/CardManagerPage';

type PageId = 'home' | 'learn' | 'practice' | 'cases' | 'study' | 'edital' | 'jurisprudence' | 'lei-seca' | 'cards' | 'performance' | 'data';

type Props = {
  user: User;
  onSignOut: () => Promise<void>;
};

const NAV: Array<{ id: PageId; label: string; icon: string }> = [
  { id: 'home', label: 'Início', icon: '⌂' },
  { id: 'learn', label: 'Aprender', icon: '▥' },
  { id: 'practice', label: 'Questões', icon: '?' },
  { id: 'cases', label: 'Estudo de Caso', icon: '✎' },
  { id: 'study', label: 'Revisar', icon: '▣' },
  { id: 'edital', label: 'Edital', icon: '☑' },
  { id: 'jurisprudence', label: 'Jurisprudência', icon: '§' },
  { id: 'lei-seca', label: 'Lei Seca', icon: '⚖' },
  { id: 'cards', label: 'Cartões', icon: '▤' },
  { id: 'performance', label: 'Desempenho', icon: '↗' },
  { id: 'data', label: 'Dados', icon: '↻' },
];

export function ModernWorkspace({ user, onSignOut }: Props) {
  const workspace = useStudyWorkspace(user);
  const [page, setPage] = useState<PageId>('home');
  const [practiceSubject, setPracticeSubject] = useState('all');
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
            {['learn','practice','cases'].includes(page) ? <LearningPage mode={page === 'practice' ? 'practice' : page === 'cases' ? 'cases' : 'learn'} user={user} profileId={workspace.profile.id} subjects={workspace.subjects} initialSubject={practiceSubject} onReview={(discipline, name) => { const subject = workspace.subjects.find((row) => row.name === DISCIPLINES[discipline]); const topic = workspace.topics.find((row) => row.subject_id === subject?.id && row.name === name); if (subject) focusStudyTopic(subject.id, topic?.id || 'all'); }} /> : null}
            {page === 'study' ? <StudyPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} decks={workspace.decks} focus={studyFocus} /> : null}
            {page === 'edital' ? <EditalPage profileId={workspace.profile.id} isBuiltin={workspace.profile.is_builtin} subjects={workspace.subjects} topics={workspace.topics} onStudyTopic={focusStudyTopic} onOpenLeiSeca={() => selectPage('lei-seca')} onPracticeSubject={(subjectId) => { const name = workspace.subjects.find((row) => row.id === subjectId)?.name; setPracticeSubject(Object.entries(DISCIPLINES).find(([,value]) => value === name)?.[0] || 'all'); selectPage('practice'); }} /> : null}
            {page === 'jurisprudence' ? <JurisprudencePage profileId={workspace.profile.id} /> : null}
            {page === 'lei-seca' ? <LeiSecaPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} decks={workspace.decks} onStudyTopic={focusStudyTopic} /> : null}
            {page === 'cards' ? <CardManagerPage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} topics={workspace.topics} decks={workspace.decks} onChanged={workspace.refresh} /> : null}
            {page === 'performance' ? <PerformancePage user={user} profileId={workspace.profile.id} subjects={workspace.subjects} onReviewWrong={startWrongReview} onReviewDue={startDueReview} /> : null}
            {page === 'data' ? <DataPage user={user} workspace={workspace} onMigrated={workspace.refresh} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function LoadingView({ seeding }: { seeding: boolean }) {
  return <div className="page-wrap loading-page"><div className="loading-orb" /><h2>{seeding ? 'Preparando seus baralhos…' : 'Carregando sua trilha…'}</h2><p>{seeding ? 'Atualizando e conferindo o material autoral sem apagar seu histórico.' : 'Sincronizando estrutura e progresso.'}</p></div>;
}

function HomePage({ user, workspace, onNavigate, onStudySubject, onReviewDue }: {
  user: User;
  workspace: ReturnType<typeof useStudyWorkspace>;
  onNavigate: (page: PageId) => void;
  onStudySubject: (subjectId: string) => void;
  onReviewDue: () => void;
}) {
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [totalCardCount, setTotalCardCount] = useState(0);
  const [leiSecaCount, setLeiSecaCount] = useState(0);
  const [editalCoveredTopicIds, setEditalCoveredTopicIds] = useState<Set<string>>(new Set());
  const [catalogCardCount, setCatalogCardCount] = useState(0);
  const [leiSecaCoveredTopics, setLeiSecaCoveredTopics] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    const profileId = workspace.profile!.id;
    setLoadError(null);
    void Promise.all([
      loadPerformance(client, user, profileId),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).is('deleted_at', null).eq('suspended', false),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).is('deleted_at', null).eq('suspended', false).eq('card_type', 'Lei seca'),
      client.from('cards').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).is('deleted_at', null).eq('suspended', false).like('source', 'Edital Verticalizado TRT-4 AJAJ 2026 V3%'),
      listOfficialEditalTopicIds(client, profileId),
      listCardsByType(client, profileId, 'Lei seca'),
    ]).then(([summary, cards, leiSeca, catalogCards, officialTopicIds, leiSecaCards]) => {
      setPerformance(summary);
      if (!cards.error) setTotalCardCount(cards.count ?? 0);
      if (!leiSeca.error) setLeiSecaCount(leiSeca.count ?? 0);
      if (!catalogCards.error) setCatalogCardCount(catalogCards.count ?? 0);
      setEditalCoveredTopicIds(officialTopicIds);
      setLeiSecaCoveredTopics(new Set(leiSecaCards.map((card) => card.topic_id).filter(Boolean)).size);
    }).catch((cause) => setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados do painel.'));
  }, [user.id, workspace.profile?.id]);

  const rootTopics = workspace.topics.filter((topic) => !topic.parent_id);
  const complementaryTopicNames = new Set(['Jurisprudência prioritária STF/TST', 'Estudo de Caso Jurídico - protocolo de treino']);
  const officialRootTopics = rootTopics.filter((topic) => !complementaryTopicNames.has(topic.name) && (!workspace.profile?.is_builtin || editalCoveredTopicIds.has(topic.id)));
  const leiSecaEligibleTopics = officialRootTopics.filter((topic) => topic.legal_basis && workspace.subjects.find((subject) => subject.id === topic.subject_id)?.name.trim().toLowerCase() !== 'português');
  const officialTopicTotal = workspace.profile?.is_builtin ? 171 : officialRootTopics.length;
  const editalCoveredTopics = officialRootTopics.filter((topic) => editalCoveredTopicIds.has(topic.id)).length;
  const editalPct = officialTopicTotal ? Math.round((Math.min(editalCoveredTopics, officialTopicTotal) / officialTopicTotal) * 100) : 0;
  const leiSecaPct = leiSecaEligibleTopics.length ? Math.round((leiSecaCoveredTopics / leiSecaEligibleTopics.length) * 100) : 0;

  const topDecks = workspace.decks.filter((deck) => deck.subject_id).slice(0, 4);

  const heroAction = () => onNavigate('learn');
  const heroLabel = 'Aprender e praticar →';

  const focusMessage = leiSecaPct < editalPct
    ? { title: 'Avance na Lei Seca.', body: `Os roteiros de Lei Seca estão vinculados a ${leiSecaPct}%. Continue pelos assuntos do edital que ainda têm espaço para leitura dirigida.`, action: 'Abrir Lei Seca', onClick: () => onNavigate('lei-seca') }
    : editalPct < 100
      ? { title: 'Continue avançando no edital.', body: `Há material vinculado a ${editalPct}% dos tópicos. Priorize agora os assuntos ainda sem cobertura completa.`, action: 'Abrir edital', onClick: () => onNavigate('edital') }
      : { title: 'Mantenha o ritmo.', body: 'A matriz está mapeada. Isso não significa domínio ou cobertura integral de conteúdo. Agora o foco é estudar, praticar e consolidar os pontos mais difíceis.', action: 'Estudar agora', onClick: () => onNavigate('study') };

  return (
    <div className="page-wrap home-page">
      <PageHeader eyebrow="SEU PAINEL" title={`Bom estudo${user.user_metadata?.given_name ? `, ${user.user_metadata.given_name}` : ''}.`} subtitle={`${workspace.profile?.name} · ${workspace.profile?.board || 'Banca em acompanhamento'} · Edital ${workspace.profile?.edital_year || 'atual'}`} />
      {loadError ? <div className="notice error"><strong>Alguns dados não carregaram.</strong><span>{loadError}</span></div> : null}

      <section className="home-action-card">
        <div className="home-action-copy">
          <span className="home-kicker">PRÓXIMA AÇÃO</span>
          <h2>Continue do ponto certo.</h2>
          <p>Abra uma sessão curta, avance no conteúdo do edital e mantenha o ritmo de estudo.</p>
          <button className="primary-action" onClick={heroAction}>{heroLabel}</button>
        </div>
        <div className="home-action-side">
          <div className="home-streak"><strong>{performance?.streakDays ?? 0}</strong><span>dias de sequência</span></div>
          <div className="home-due"><strong>{performance?.dueNow ?? 0}</strong><span>pendentes hoje</span></div>
        </div>
      </section>

      <section className="home-progress-card">
        <div className="home-progress-head">
          <div>
            <span className="panel-label">MATRIZ DE PREPARAÇÃO</span>
            <h2>{Math.min(editalCoveredTopics, officialTopicTotal)}/{officialTopicTotal} assuntos mapeados</h2>
            <p>{workspace.profile?.is_builtin ? `Catálogo TRT-4 AJAJ: ${catalogCardCount}/1.437 registros autorais carregados (roteiros e conteúdo) · 171 tópicos da matriz.` : 'Cobertura calculada a partir dos tópicos com cartões vinculados.'}</p>
          </div>
          <strong className="home-progress-percent">{editalPct}%</strong>
        </div>
        <div className="home-progress-track" aria-label={`Cobertura do edital: ${editalPct}%`}><span style={{ width: `${editalPct}%` }} /></div>
        <div className="home-progress-meta">
          <span><strong>{totalCardCount}</strong> cartões totais</span>
          {workspace.profile?.is_builtin ? <span><strong>{catalogCardCount}</strong> material autoral</span> : null}
          <span><strong>{leiSecaCount}</strong> roteiros de Lei Seca</span>
          <span><strong>{performance?.accuracy ?? 0}%</strong> recuperação declarada</span>
        </div>
      </section>

      <div className="home-metric-grid">
        <MetricTile label="Cartões totais" value={totalCardCount} helper="conteúdo e roteiros; não mede domínio" />
        <MetricTile label="Lei Seca" value={leiSecaCount} helper={`${leiSecaPct}% dos assuntos com base legal`} />
        <MetricTile label="Recuperação declarada" value={`${performance?.accuracy ?? 0}%`} helper={`${performance?.totalReviews ?? 0} autoavaliações registradas`} />
        <MetricTile label="Erros abertos" value={performance?.openErrors ?? 0} helper="pontos para reforçar" />
      </div>

      <section className="home-quick-actions" aria-label="Atalhos de estudo">
        <button onClick={() => onNavigate('study')}><span>▣</span><strong>Revisar</strong><small>Abrir sessão</small></button>
        <button onClick={() => onNavigate('edital')}><span>☑</span><strong>Edital</strong><small>Ver cobertura</small></button>
        <button onClick={() => onNavigate('lei-seca')}><span>⚖</span><strong>Lei Seca</strong><small>Leitura dirigida</small></button>
        <button onClick={() => onNavigate('performance')}><span>↗</span><strong>Desempenho</strong><small>Questões e revisões</small></button>
      </section>

      <div className="content-grid two-one home-bottom-grid">
        <section className="panel-card"><div className="panel-heading"><div><span>BARALHOS</span><h2>Continuar por disciplina</h2></div><button className="link-button" onClick={() => onNavigate('study')}>Ver todos</button></div><div className="deck-list-clean">{topDecks.map((deck, index) => <button key={deck.id} onClick={() => onStudySubject(deck.subject_id!)}><span className="deck-number">{String(index + 1).padStart(2, '0')}</span><span className="deck-copy"><strong>{deck.name}</strong><small>{deck.is_builtin ? 'Baralho de preparação' : 'Baralho personalizado'}</small></span><span className="chevron">›</span></button>)}</div></section>
        <section className="panel-card accent-panel home-focus-panel"><span className="panel-label">PRÓXIMO FOCO</span><h2>{focusMessage.title}</h2><p>{focusMessage.body}</p><button onClick={focusMessage.onClick}>{focusMessage.action}</button></section>
      </div>
    </div>
  );
}


function DataPage({ user, workspace, onMigrated }: { user: User; workspace: ReturnType<typeof useStudyWorkspace>; onMigrated: () => Promise<void> }) {
  return <div className="page-wrap"><PageHeader eyebrow="CONTA E DADOS" title="Sincronização" subtitle="Migre o legado, confira a nuvem e mantenha uma cópia local durante a transição." /><ProfileSwitcher profiles={workspace.profiles} activeProfileId={workspace.profile?.id ?? null} onSwitch={workspace.switchProfile} onCreate={workspace.createProfile} /><BackupPanel user={user} profile={workspace.profile ? { id: workspace.profile.id, name: workspace.profile.name, slug: workspace.profile.slug } : null} onRestored={onMigrated} /><LegacyMigrationPanel user={user} onMigrated={onMigrated} /><SyncPanel user={user} /></div>;
}
