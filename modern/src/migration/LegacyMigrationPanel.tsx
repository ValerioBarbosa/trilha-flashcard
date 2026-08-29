import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { readLegacyLocalSnapshot, countSnapshotEntries } from '../sync/local-snapshot';
import { migrateLegacyLocalData, type LegacyMigrationReport } from './legacy-to-relational';

type Props = { user: User; onMigrated?: () => void | Promise<void> };

type Status = 'idle' | 'running' | 'done' | 'error';

export function LegacyMigrationPanel({ user, onMigrated }: Props) {
  const localEntries = useMemo(() => countSnapshotEntries(readLegacyLocalSnapshot()), []);
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState<LegacyMigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function migrate() {
    setStatus('running');
    setError(null);
    try {
      const nextReport = await migrateLegacyLocalData(getSupabaseClient(), user);
      setReport(nextReport);
      setStatus('done');
      await onMigrated?.();
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section className="migration-panel" aria-labelledby="migration-title">
      <div className="section-heading">
        <div>
          <h2 id="migration-title">Migração dos dados locais</h2>
          <p>
            Copia cartões personalizados e alterações salvas no navegador para o novo banco relacional sem apagar o armazenamento atual.
          </p>
        </div>
        <button type="button" onClick={() => void migrate()} disabled={status === 'running' || localEntries === 0}>
          {status === 'running' ? 'Migrando…' : status === 'done' ? 'Migrar novamente' : 'Migrar dados locais'}
        </button>
      </div>

      <div className="migration-summary">
        <span>Entradas locais sincronizáveis</span>
        <strong>{localEntries}</strong>
      </div>

      {error ? <p className="pilot-error" role="alert">{error}</p> : null}

      {report ? (
        <dl className="status-grid compact migration-report">
          <div><dt>Perfis</dt><dd>{report.profiles}</dd></div>
          <div><dt>Disciplinas</dt><dd>{report.subjects}</dd></div>
          <div><dt>Tópicos</dt><dd>{report.topics}</dd></div>
          <div><dt>Baralhos</dt><dd>{report.decks}</dd></div>
          <div><dt>Cartões</dt><dd>{report.cards}</dd></div>
          <div><dt>Ignorados</dt><dd>{report.skippedCards}</dd></div>
        </dl>
      ) : null}

      <p className="pilot-note">
        A operação é idempotente: reexecutar atualiza os mesmos cartões legados em vez de criar cópias quando existe identificador estável.
      </p>
    </section>
  );
}
