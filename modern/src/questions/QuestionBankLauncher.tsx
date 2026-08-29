import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { QuestionBankPreview } from './QuestionBankPreview';
import './question-bank-launcher.css';

export function QuestionBankLauncher({ user }: { user: User }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="question-bank-launcher" onClick={() => setOpen(true)}>
        <span>?</span>
        Banco de questões
      </button>
      {open ? (
        <div className="question-bank-overlay" role="dialog" aria-modal="true" aria-label="Banco de questões">
          <QuestionBankPreview user={user} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
