import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import type { DeckRow, SubjectRow, TopicRow } from '../study/domain-repository';
import {
  createCard,
  importCards,
  listManagedCards,
  markImportDuplicates,
  parseJsonImport,
  restoreCard,
  setCardSuspended,
  softDeleteCard,
  updateCard,
  type CardDraft,
  type ImportCandidate,
  type ManagedCard,
} from './card-manager-repository';

type Props = {
  user: User;
  profileId: string;
  subjects: SubjectRow[];
  topics: TopicRow[];
  decks: DeckRow[];
  onChanged?: () => void | Promise<void>;
};

type FormState = CardDraft & { id?: string; tagsText: string };

const EMPTY_FORM: FormState = {
  deckId: '', subjectId: '', topicId: '', front: '', back: '', legalBasis: '', example: '', complement: '', pitfall: '', mnemonic: '', priority: '', difficulty: '', tags: [], tagsText: '', cardType: '', source: '',
};

export function CardManagerPage({ user, profileId, subjects, topics, decks, onChanged }: Props) {
  const [cards, setCards] = useState<ManagedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [deckFilter, setDeckFilter] = useState('all');
  const [showTrash, setShowTrash] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try { setCards(await listManagedCards(getSupabaseClient(), profileId)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [profileId]);

  const filtered = useMemo(() => cards.filter((card) => {
    if (showTrash ? !card.deleted_at : Boolean(card.deleted_at)) return false;
    if (subjectFilter !== 'all' && card.subject_id !== subjectFilter) return false;
    if (deckFilter !== 'all' && card.deck_id !== deckFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${card.front} ${card.back} ${card.legal_basis || ''} ${(card.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [cards, showTrash, subjectFilter, deckFilter, query]);

  const subjectTopics = topics.filter((topic) => topic.subject_id === form.subjectId);
  const subjectDecks = decks.filter((deck) => !form.subjectId || deck.subject_id === form.subjectId);

  function openCreate() {
    const subjectId = subjects[0]?.id || '';
    const deckId = decks.find((deck) => deck.subject_id === subjectId)?.id || decks[0]?.id || '';
    setForm({ ...EMPTY_FORM, subjectId, deckId });
    setEditorOpen(true);
    setMessage(null);
  }

  function openEdit(card: ManagedCard) {
    setForm({
      id: card.id,
      deckId: card.deck_id,
      subjectId: card.subject_id || '',
      topicId: card.topic_id || '',
      front: card.front,
      back: card.back,
      legalBasis: card.legal_basis || '',
      example: card.example || '',
      complement: card.complement || '',
      pitfall: card.pitfall || '',
      mnemonic: card.mnemonic || '',
      priority: (card.priority as 'A'|'B'|'C'|'') || '',
      difficulty: (card.difficulty as 'easy'|'medium'|'hard'|'') || '',
      tags: card.tags || [],
      tagsText: (card.tags || []).join(', '),
      cardType: card.card_type || '',
      source: card.source || '',
    });
    setEditorOpen(true);
    setMessage(null);
  }

  async function save() {
    setMessage(null);
    if (!form.subjectId) return setMessage('Disciplina é obrigatória.');
    if (!form.deckId) return setMessage('Baralho é obrigatório.');
    if (!form.front.trim() || !form.back.trim()) return setMessage('Pergunta e resposta são obrigatórias.');
    const draft: CardDraft = { ...form, tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean) };
    try {
      if (form.id) await updateCard(getSupabaseClient(), form.id, draft);
      else await createCard(getSupabaseClient(), user, profileId, draft);
      setEditorOpen(false);
      await refresh();
      await onChanged?.();
    } catch (cause) {
      setMessage(cause instanceof Error && cause.message === 'card-duplicate' ? 'Este cartão já existe no banco. A inclusão foi bloqueada.' : cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function moveToTrash(cardId: string) { await softDeleteCard(getSupabaseClient(), cardId); await refresh(); await onChanged?.(); }
  async function restore(cardId: string) { try { await restoreCard(getSupabaseClient(), cardId); await refresh(); await onChanged?.(); } catch (cause) { setMessage(cause instanceof Error && cause.message === 'card-duplicate' ? 'Não foi possível restaurar: já existe um cartão igual ativo.' : String(cause)); } }
  async function toggleSuspend(card: ManagedCard) { await setCardSuspended(getSupabaseClient(), card.id, !card.suspended); await refresh(); }

  async function handleImportFile(file: File) {
    setImportStatus(null);
    setImportCandidates([]);
    try {
      const text = await file.text();
      const defaults = { subjectId: subjects[0]?.id || '', deckId: decks[0]?.id || '' };
      const parsed = parseJsonImport(text, defaults);
      const marked = await markImportDuplicates(getSupabaseClient(), profileId, parsed);
      setImportCandidates(marked);
      setImportStatus(`${marked.length} cartões analisados. ${marked.filter((row) => row.duplicate).length} duplicados bloqueados.`);
    } catch (cause) {
      setImportStatus(`Falha ao ler arquivo: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  async function confirmImport() {
    const result = await importCards(getSupabaseClient(), user, profileId, importCandidates);
    setImportStatus(`${result.inserted} incluídos · ${result.duplicates} duplicados ignorados · ${result.failed} falhas.`);
    await refresh();
    await onChanged?.();
    if (!result.failed) setImportCandidates((current) => current.map((row) => ({ ...row, duplicate: true, duplicateReason: row.duplicateReason || 'Importado com sucesso.' })));
  }

  return (
    <div className="page-wrap card-manager-page">
      <div className="page-header">
        <div><span className="page-eyebrow">BANCO DE CARTÕES</span><h1>Gerenciar cartões</h1><p>Edite, filtre, importe e organize cartões por disciplina, assunto e baralho.</p></div>
        <div className="manager-header-actions"><button className="secondary-outline" onClick={() => setImportOpen(true)}>Importar cartões</button><button className="primary-action" onClick={openCreate}>+ Novo cartão</button></div>
      </div>

      <div className="manager-toolbar">
        <div className="search-field manager-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pergunta, resposta, base legal ou tag" /></div>
        <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">Todas as disciplinas</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <select value={deckFilter} onChange={(event) => setDeckFilter(event.target.value)}><option value="all">Todos os baralhos</option>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>
        <button className={showTrash ? 'trash-toggle active' : 'trash-toggle'} onClick={() => setShowTrash((value) => !value)}>{showTrash ? '← Cartões ativos' : 'Lixeira'}</button>
      </div>

      <div className="manager-summary"><strong>{filtered.length}</strong><span>{showTrash ? 'cartões na lixeira' : 'cartões encontrados'}</span></div>
      {message ? <div className="notice error"><span>{message}</span></div> : null}

      {loading ? <div className="study-empty">Carregando cartões…</div> : !filtered.length ? <div className="empty-feature"><div className="empty-icon">＋</div><h2>Nenhum cartão encontrado.</h2><p>Ajuste os filtros ou crie um novo cartão.</p></div> : (
        <div className="card-manager-list">
          {filtered.map((card) => {
            const subject = subjects.find((item) => item.id === card.subject_id);
            const topic = topics.find((item) => item.id === card.topic_id);
            const deck = decks.find((item) => item.id === card.deck_id);
            return <article key={card.id} className={`managed-card ${card.suspended ? 'suspended' : ''}`}><div className="managed-card-main"><div className="managed-card-meta">{subject ? <span>{subject.name}</span> : null}{topic ? <span>{topic.name}</span> : null}{card.priority ? <span className={`priority-pill priority-${card.priority.toLowerCase()}`}>{card.priority}</span> : null}{card.suspended ? <span className="muted-pill">Suspenso</span> : null}</div><h2>{card.front}</h2><p>{card.back}</p>{card.legal_basis ? <small>Base legal: {card.legal_basis}</small> : null}<div className="managed-tags">{(card.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div></div><div className="managed-card-side"><small>{deck?.name || 'Baralho'}</small>{showTrash ? <button onClick={() => void restore(card.id)}>Restaurar</button> : <><button onClick={() => openEdit(card)}>Editar</button><button className="muted-action" onClick={() => void toggleSuspend(card)}>{card.suspended ? 'Reativar' : 'Suspender'}</button><button className="danger-text" onClick={() => void moveToTrash(card.id)}>Excluir</button></>}</div></article>;
          })}
        </div>
      )}

      {editorOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}><div className="modal-card card-editor-modal" role="dialog" aria-modal="true" aria-labelledby="card-editor-title"><div className="modal-heading"><div><span className="page-eyebrow">{form.id ? 'EDITAR' : 'NOVO'}</span><h2 id="card-editor-title">{form.id ? 'Editar cartão' : 'Novo cartão'}</h2></div><button className="modal-close" onClick={() => setEditorOpen(false)}>×</button></div><div className="form-grid"><label><span>Disciplina *</span><select value={form.subjectId} onChange={(event) => { const subjectId = event.target.value; const deckId = decks.find((deck) => deck.subject_id === subjectId)?.id || ''; setForm((current) => ({ ...current, subjectId, deckId, topicId: '' })); }}><option value="">Selecione</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span>Assunto</span><select value={form.topicId || ''} onChange={(event) => setForm((current) => ({ ...current, topicId: event.target.value }))}><option value="">Sem assunto</option>{subjectTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label className="full"><span>Baralho *</span><select value={form.deckId} onChange={(event) => setForm((current) => ({ ...current, deckId: event.target.value }))}><option value="">Selecione</option>{subjectDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label><label className="full"><span>Pergunta *</span><textarea rows={3} value={form.front} onChange={(event) => setForm((current) => ({ ...current, front: event.target.value }))} /></label><label className="full"><span>Resposta *</span><textarea rows={5} value={form.back} onChange={(event) => setForm((current) => ({ ...current, back: event.target.value }))} /></label><label className="full"><span>Base legal</span><input value={form.legalBasis || ''} onChange={(event) => setForm((current) => ({ ...current, legalBasis: event.target.value }))} placeholder="Ex.: CF, art. 111" /></label><label><span>Prioridade</span><select value={form.priority || ''} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as FormState['priority'] }))}><option value="">Sem prioridade</option><option>A</option><option>B</option><option>C</option></select></label><label><span>Dificuldade</span><select value={form.difficulty || ''} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as FormState['difficulty'] }))}><option value="">Não definida</option><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label><label className="full"><span>Tags</span><input value={form.tagsText} onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))} placeholder="trt4, fcc, justiça-do-trabalho" /></label><details className="advanced-fields full"><summary>Campos avançados</summary><div className="form-grid inner"><label className="full"><span>Complemento</span><textarea rows={2} value={form.complement || ''} onChange={(event) => setForm((current) => ({ ...current, complement: event.target.value }))} /></label><label className="full"><span>Pegadinha</span><textarea rows={2} value={form.pitfall || ''} onChange={(event) => setForm((current) => ({ ...current, pitfall: event.target.value }))} /></label><label className="full"><span>Mnemônico</span><textarea rows={2} value={form.mnemonic || ''} onChange={(event) => setForm((current) => ({ ...current, mnemonic: event.target.value }))} /></label><label className="full"><span>Exemplo</span><textarea rows={2} value={form.example || ''} onChange={(event) => setForm((current) => ({ ...current, example: event.target.value }))} /></label></div></details></div>{message ? <p className="pilot-error">{message}</p> : null}<div className="modal-actions"><button className="secondary-outline" onClick={() => setEditorOpen(false)}>Cancelar</button><button className="primary-action" onClick={() => void save()}>Salvar cartão</button></div></div></div> : null}

      {importOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}><div className="modal-card import-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="page-eyebrow">IMPORTAÇÃO</span><h2>Importar cartões</h2><p>Arquivos JSON são analisados antes da inclusão. Duplicados ficam destacados em vermelho e não entram no banco.</p></div><button className="modal-close" onClick={() => setImportOpen(false)}>×</button></div><label className="file-drop"><input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && void handleImportFile(event.target.files[0])} /><strong>Escolher arquivo JSON</strong><span>Formatos: array de cartões ou objeto com propriedade cards.</span></label>{importStatus ? <p className="import-status">{importStatus}</p> : null}{importCandidates.length ? <div className="import-preview"><div className="import-preview-head"><strong>Pré-visualização</strong><span>{importCandidates.filter((row) => !row.duplicate).length} aptos para importar</span></div>{importCandidates.slice(0, 100).map((row) => <div key={row.row} className={`import-row ${row.duplicate ? 'duplicate' : ''}`}><span>{row.row}</span><div><strong>{row.front || 'Pergunta vazia'}</strong><small>{row.back || 'Resposta vazia'}</small>{row.duplicateReason ? <em>{row.duplicateReason}</em> : null}</div><span>{row.duplicate ? 'Duplicado' : 'Novo'}</span></div>)}</div> : null}<div className="modal-actions"><button className="secondary-outline" onClick={() => setImportOpen(false)}>Fechar</button><button className="primary-action" disabled={!importCandidates.some((row) => !row.duplicate)} onClick={() => void confirmImport()}>Importar válidos</button></div></div></div> : null}
    </div>
  );
}
