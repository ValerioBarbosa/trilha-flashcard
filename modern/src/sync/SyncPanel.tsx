import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { SyncController, type SyncStatus } from './sync-controller';

const INITIAL_STATUS: SyncStatus = {
  busy: false,
  lastSyncedAt: null,
  remoteUpdatedAt: null,
  localEntries: 0,
  remoteEntries: 0,
  error: null,
};

type Props = {
  user: User;
};

export function SyncPanel({ user }: Props) {
  const controller = useMemo(() => new SyncController(getSupabaseClient()), []);
  const [status, setStatus] = useState<SyncStatus>(INITIAL_STATUS);
  const [remoteToken, setRemoteToken] = useState<string | null>(null);

  async function inspect() {
    try {
      const result = await controller.inspect(user.id);
      setStatus(result.status);
      setRemoteToken(result.remote?.updatedAtISO ?? null);
    } catch {
      setStatus(controller.getStatus());
    }
  }

  async function pullRemote() {
    if (!window.confirm('Substituir os dados locais sincronizáveis pela cópia da nuvem?')) return;
    try {
      const next = await controller.pullRemote(user.id);
      setStatus(next);
      setRemoteToken(next.remoteUpdatedAt);
    } catch {
      setStatus(controller.getStatus());
    }
  }

  async function pushLocal() {
    try {
      const next = await controller.pushLocal(user.id, remoteToken, false);
      setStatus(next);
      setRemoteToken(next.remoteUpdatedAt);
    } catch (error) {
      const next = controller.getStatus();
      setStatus(next);

      if (error instanceof Error && error.message === 'cloud-conflict') {
        const overwrite = window.confirm(
          'A nuvem mudou desde a última leitura. Deseja substituir a cópia da nuvem pelos dados deste dispositivo?',
        );
        if (!overwrite) return;

        try {
          const forced = await controller.pushLocal(user.id, remoteToken, true);
          setStatus(forced);
          setRemoteToken(forced.remoteUpdatedAt);
        } catch {
          setStatus(controller.getStatus());
        }
      }
    }
  }

  return (
    <section className="sync-panel" aria-labelledby="sync-title">
      <div className="section-heading">
        <div>
          <h2 id="sync-title">Sincronização Supabase</h2>
          <p>Validação segura do fluxo local-first usando a mesma tabela da versão atual.</p>
        </div>
        <button type="button" className="secondary" onClick={() => void inspect()} disabled={status.busy}>
          Verificar
        </button>
      </div>

      <dl className="status-grid compact">
        <div>
          <dt>Dados locais</dt>
          <dd>{status.localEntries} chaves</dd>
        </div>
        <div>
          <dt>Dados na nuvem</dt>
          <dd>{status.remoteEntries} chaves</dd>
        </div>
        <div className="status-wide">
          <dt>Última versão remota</dt>
          <dd>{status.remoteUpdatedAt ? new Date(status.remoteUpdatedAt).toLocaleString('pt-BR') : 'Ainda não verificada'}</dd>
        </div>
      </dl>

      {status.error ? <p className="pilot-error" role="alert">{status.error}</p> : null}

      <div className="pilot-actions">
        <button type="button" onClick={() => void pushLocal()} disabled={status.busy}>
          Enviar este dispositivo
        </button>
        <button type="button" className="secondary" onClick={() => void pullRemote()} disabled={status.busy}>
          Recuperar da nuvem
        </button>
      </div>

      <p className="pilot-note">
        O envio usa controle de conflito. A recuperação pede confirmação antes de substituir dados sincronizáveis locais.
      </p>
    </section>
  );
}
