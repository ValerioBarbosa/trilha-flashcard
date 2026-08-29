import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { LegacyMigrationPanel } from './migration/LegacyMigrationPanel';
import { StudyDashboard } from './study/StudyDashboard';
import { SyncPanel } from './sync/SyncPanel';
import './styles.css';

export function App() {
  const { user, loading, initialized, error, signIn, signOut, refresh } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [studyRefreshSignal, setStudyRefreshSignal] = useState(0);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <main className="pilot-shell">
      <section className="pilot-card" aria-labelledby="pilot-title">
        <div className="pilot-badge">TRILHA MODERNA</div>
        <h1 id="pilot-title">Trilha Flashcard</h1>
        <p className="pilot-subtitle">
          Fundação React + TypeScript conectada ao Supabase, preservando o app local-first durante a migração.
        </p>

        <dl className="status-grid">
          <div>
            <dt>Estado</dt>
            <dd>{loading ? 'Carregando' : initialized ? 'Pronto' : 'Inicializando'}</dd>
          </div>
          <div>
            <dt>Sessão</dt>
            <dd>{user ? 'Conectada' : 'Desconectada'}</dd>
          </div>
          <div className="status-wide">
            <dt>Usuário</dt>
            <dd>{user?.email ?? 'Nenhum usuário autenticado'}</dd>
          </div>
        </dl>

        {(error || actionError) ? (
          <p className="pilot-error" role="alert">{actionError ?? error}</p>
        ) : null}

        <div className="pilot-actions">
          {user ? (
            <>
              <button type="button" onClick={() => void run(refresh)} disabled={loading}>
                Atualizar sessão
              </button>
              <button type="button" className="secondary" onClick={() => void run(signOut)} disabled={loading}>
                Sair
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void run(signIn)} disabled={loading || Boolean(error)}>
              Entrar com Google
            </button>
          )}
        </div>

        {user ? (
          <>
            <StudyDashboard user={user} refreshSignal={studyRefreshSignal} />
            <LegacyMigrationPanel
              user={user}
              onMigrated={() => setStudyRefreshSignal((value) => value + 1)}
            />
            <SyncPanel user={user} />
          </>
        ) : null}

        <p className="pilot-note">
          O armazenamento legado continua preservado. A migração relacional copia os dados e pode ser reexecutada sem apagar o banco local.
        </p>
      </section>
    </main>
  );
}
