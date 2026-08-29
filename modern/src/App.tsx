import { useState } from 'react';
import { ModernWorkspace } from './app/ModernWorkspace';
import { useAuth } from './auth/AuthContext';
import { CardManagerLauncher } from './cards/CardManagerLauncher';
import { PdfImportLauncher } from './cards/PdfImportLauncher';
import './styles.css';

export function App() {
  const { user, loading, initialized, error, signIn, signOut } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSignIn() {
    setActionError(null);
    try {
      await signIn();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  if (user) {
    return (
      <>
        <ModernWorkspace user={user} onSignOut={signOut} />
        <PdfImportLauncher user={user} />
        <CardManagerLauncher user={user} />
      </>
    );
  }

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <div className="auth-brand"><span>T</span><strong>Trilha Concursos</strong></div>
        <div className="auth-copy">
          <span className="page-eyebrow">ESTUDE O QUE MAIS IMPORTA</span>
          <h1>Seu edital vira uma trilha de aprovação.</h1>
          <p>Flashcards, questões, jurisprudência, revisão e desempenho no mesmo lugar — com seus dados sincronizados.</p>
        </div>
        <div className="auth-proof"><strong>Local-first</strong><span>Você continua estudando mesmo quando a conexão falha.</span></div>
      </section>
      <section className="auth-panel">
        <div className="login-card">
          <span className="brand-mark large">T</span>
          <h2>Entrar na Trilha</h2>
          <p>Use sua conta Google para acessar estudos e sincronização.</p>
          {(error || actionError) ? <div className="notice error"><span>{actionError ?? error}</span></div> : null}
          <button className="google-button" onClick={() => void handleSignIn()} disabled={loading || !initialized}>
            <span className="google-g">G</span>
            {loading ? 'Conectando…' : 'Continuar com Google'}
          </button>
          <small className="auth-note">A versão moderna usa o mesmo projeto Supabase e preserva o armazenamento local durante a migração.</small>
        </div>
      </section>
    </main>
  );
}
