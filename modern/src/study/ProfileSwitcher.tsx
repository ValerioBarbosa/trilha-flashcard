import { useState } from 'react';
import type { ProfileRow } from './domain-repository';
import type { NewProfileInput } from './study-repository';

type Props = {
  profiles: ProfileRow[];
  activeProfileId: string | null;
  onSwitch: (profileId: string) => void;
  onCreate: (input: NewProfileInput) => Promise<ProfileRow>;
};

const EMPTY_FORM: NewProfileInput = { name: '', role: '', board: '', editalYear: '' };

export function ProfileSwitcher({ profiles, activeProfileId, onSwitch, onCreate }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewProfileInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!form.name.trim()) { setError('Informe um nome para o perfil.'); return; }
    setSaving(true);
    try {
      await onCreate(form);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="migration-panel profile-panel" aria-labelledby="profiles-title">
      <div className="section-heading">
        <div>
          <h2 id="profiles-title">Perfis de concurso</h2>
          <p>Crie um perfil por certame. Cada perfil tem seus próprios baralhos, cartões e desempenho.</p>
        </div>
        <button type="button" className="secondary" onClick={() => setFormOpen((value) => !value)}>{formOpen ? 'Cancelar' : '+ Novo perfil'}</button>
      </div>

      <div className="profile-list">
        {profiles.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`profile-row ${item.id === activeProfileId ? 'active' : ''}`}
            onClick={() => onSwitch(item.id)}
            disabled={item.id === activeProfileId}
          >
            <strong>{item.name}</strong>
            <small>{[item.role, item.board, item.edital_year].filter(Boolean).join(' · ') || 'Sem detalhes cadastrados'}</small>
            {item.id === activeProfileId ? <span className="profile-active-tag">Ativo</span> : null}
          </button>
        ))}
      </div>

      {formOpen ? (
        <div className="form-grid inner">
          <label className="full"><span>Nome do concurso *</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: TJ-SP · Escrevente" /></label>
          <label><span>Cargo</span><input value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} /></label>
          <label><span>Banca</span><input value={form.board} onChange={(event) => setForm((current) => ({ ...current, board: event.target.value }))} /></label>
          <label><span>Ano do edital</span><input value={form.editalYear} onChange={(event) => setForm((current) => ({ ...current, editalYear: event.target.value }))} /></label>
          {error ? <p className="pilot-error full">{error}</p> : null}
          <div className="full"><button type="button" className="primary-action" disabled={saving} onClick={() => void submit()}>{saving ? 'Criando…' : 'Criar perfil'}</button></div>
        </div>
      ) : null}
    </section>
  );
}
