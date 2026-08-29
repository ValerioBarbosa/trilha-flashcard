import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useStudyWorkspace } from '../study/useStudyWorkspace';
import { CardManagerPage } from './CardManagerPage';

export function CardManagerLauncher({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const workspace = useStudyWorkspace(user);

  return (
    <>
      <button type="button" className="card-manager-launcher" onClick={() => setOpen(true)}>
        <span>▤</span>
        Gerenciar cartões
      </button>

      {open ? (
        <div className="manager-overlay">
          <div className="manager-overlay-bar">
            <div>
              <strong>Gerenciar cartões</strong>
              <small>{workspace.profile?.name || 'Trilha Concursos'}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)}>Voltar aos estudos ×</button>
          </div>
          {workspace.loading || !workspace.profile ? (
            <div className="page-wrap loading-page"><div className="loading-orb" /><h2>Carregando banco de cartões…</h2></div>
          ) : (
            <CardManagerPage
              user={user}
              profileId={workspace.profile.id}
              subjects={workspace.subjects}
              topics={workspace.topics}
              decks={workspace.decks}
              onChanged={workspace.refresh}
            />
          )}
        </div>
      ) : null}
    </>
  );
}
