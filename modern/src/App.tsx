import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import './styles.css';

export function App() {
  const { user, loading, initialized, error, signIn, signOut, refresh } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

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
        <div className="pilot-badge">LABORATÓRIO REACT</div>
        <h1 id="pilot-title">Trilha Flashcard</h1>
        <p className="pilot-subtitle">
          Piloto isolado para validar autenticação Supabase antes da migração da interface principal.
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

        <p className="pilot-note">
          Este módulo não substitui o app atual e não altera cartões, IndexedDB ou Firebase.
        </p>
      </section>
    </main>
  );
}
