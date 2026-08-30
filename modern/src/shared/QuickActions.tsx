import { useState } from 'react';

const ACTIONS = [
  { selector: '.question-manager-launcher', icon: '?', title: 'Gerenciar questões', detail: 'Cadastre e organize questões' },
  { selector: '.error-launcher', icon: '!', title: 'Caderno de erros', detail: 'Revise suas pendências' },
  { selector: '.pdf-import-launcher', icon: 'PDF', title: 'Importar PDF', detail: 'Importe cartões de PDF' },
  { selector: '.card-manager-launcher', icon: '▤', title: 'Gerenciar cartões', detail: 'Gerencie seus cartões' },
] as const;

export function QuickActions({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);

  function launch(selector: string) {
    setOpen(false);
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLButtonElement>(selector);
      target?.click();
    });
  }

  return (
    <>
      <button type="button" className="quick-actions-trigger" onClick={() => setOpen(true)} aria-label="Abrir ações rápidas">
        <span className="quick-grid-icon" aria-hidden="true"><i /><i /><i /><i /></span>
        <strong>Ações</strong>
      </button>
      {open ? (
        <div className="quick-actions-backdrop" onClick={() => setOpen(false)}>
          <section className="quick-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-actions-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span className="page-eyebrow">ATALHOS</span><h2 id="quick-actions-title">Ações rápidas</h2></div><button type="button" className="quick-actions-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button></header>
            <div className="quick-actions-list">
              {ACTIONS.map((action) => (
                <button type="button" key={action.selector} onClick={() => launch(action.selector)}>
                  <span className="quick-action-icon">{action.icon}</span>
                  <span><strong>{action.title}</strong><small>{action.detail}</small></span>
                  <b aria-hidden="true">›</b>
                </button>
              ))}
            </div>
            <button type="button" className="quick-signout" onClick={() => void onSignOut()}><span>↪</span> Sair</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
