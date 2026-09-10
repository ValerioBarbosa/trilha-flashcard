import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { downloadBackupFile, exportBackup, parseBackupFile, restoreBackup } from './backup';

type Props = {
  user: User;
  profile: { id: string; name: string; slug: string } | null;
  onRestored?: () => void | Promise<void>;
};

export function BackupPanel({ user, profile, onRestored }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await exportBackup(getSupabaseClient(), profile);
      downloadBackupFile(payload);
      setMessage(`Backup baixado: ${payload.cards.length} cartões, ${payload.subjects.length} disciplinas.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const payload = parseBackupFile(text);
      const report = await restoreBackup(getSupabaseClient(), user, profile.id, payload);
      setMessage(`Backup restaurado: ${report.cards} cartões, ${report.subjects} disciplinas, ${report.decks} baralhos.`);
      await onRestored?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="migration-panel" aria-labelledby="backup-title">
      <div className="section-heading">
        <div>
          <h2 id="backup-title">Backup manual</h2>
          <p>Baixe um arquivo `.json` com disciplinas, assuntos, baralhos, cartões, revisões e caderno de erros do perfil atual, ou restaure um backup anterior deste mesmo perfil.</p>
        </div>
      </div>
      <div className="backup-actions">
        <button type="button" className="secondary-outline" disabled={busy || !profile} onClick={() => void handleExport()}>{busy ? 'Processando…' : 'Baixar backup completo'}</button>
        <label className="secondary-outline file-input-label">
          Restaurar backup
          <input type="file" accept="application/json,.json" disabled={busy || !profile} onChange={(event) => event.target.files?.[0] && void handleImport(event.target.files[0])} />
        </label>
      </div>
      {message ? <p className="import-status">{message}</p> : null}
      {error ? <p className="pilot-error">{error}</p> : null}
    </section>
  );
}
