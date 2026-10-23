import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { useStudyWorkspace } from '../study/useStudyWorkspace';
import { createManualError, deleteManualError, listErrorNotebook, setErrorCategory, setErrorResolved, type ErrorCategory, type ErrorNotebookRow } from './error-notebook-repository';
import { createCard } from '../cards/card-manager-repository';
import './error-notebook.css';

const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  content: 'Conteúdo',
  distraction: 'Distração',
  interpretation: 'Interpretação',
  'lei-seca': 'Lei Seca',
  jurisprudence: 'Jurisprudência',
};

export function ErrorNotebookLauncher({ user }: { user: User }) {
  const workspace = useStudyWorkspace(user);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ErrorNotebookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ErrorCategory>('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [correction, setCorrection] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [manualCategory, setManualCategory] = useState<ErrorCategory | ''>('');

  async function refresh() {
    if (!workspace.profile) return;
    setLoading(true);
    try { setRows(await listErrorNotebook(getSupabaseClient(), workspace.profile.id)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open && workspace.profile) void refresh(); }, [open, workspace.profile?.id]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (!showResolved && row.resolved) return false;
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    const haystack = `${row.title} ${row.note || ''} ${row.correction || ''} ${row.legal_basis || ''}`.toLowerCase();
    return !query.trim() || haystack.includes(query.toLowerCase());
  }), [rows, showResolved, query, categoryFilter]);

  const topics = workspace.topics.filter((topic) => !subjectId || topic.subject_id === subjectId);

  async function createManual() {
    if (!workspace.profile || !title.trim()) return;
    await createManualError(getSupabaseClient(), user, workspace.profile.id, { subjectId, topicId, category: manualCategory, title, note, correction, legalBasis });
    setTitle(''); setNote(''); setCorrection(''); setLegalBasis(''); setSubjectId(''); setTopicId(''); setManualCategory(''); setManualOpen(false);
    await refresh();
  }

  async function toggle(row: ErrorNotebookRow) { await setErrorResolved(getSupabaseClient(), row.id, !row.resolved); await refresh(); }
  async function changeCategory(row: ErrorNotebookRow, category: ErrorCategory | '') { await setErrorCategory(getSupabaseClient(), row.id, category); await refresh(); }
  async function createFlashcardFromError(row: ErrorNotebookRow) {
    if (!workspace.profile || !row.subject_id) { setFeedback('Associe uma disciplina antes de criar o flashcard.'); return; }
    const deck = workspace.decks.find((item) => item.subject_id === row.subject_id);
    if (!deck) { setFeedback('Nenhum baralho encontrado para esta disciplina.'); return; }
    const back = row.correction?.trim() || row.note?.trim();
    if (!back) { setFeedback('Adicione uma correção antes de criar o flashcard.'); return; }
    try {
      await createCard(getSupabaseClient(), user, workspace.profile.id, {
        deckId: deck.id,
        subjectId: row.subject_id,
        topicId: row.topic_id,
        front: row.title,
        back,
        legalBasis: row.legal_basis || '',
        cardType: 'Erro convertido',
        priority: 'A',
        tags: ['caderno-de-erros', row.category || row.kind],
        source: 'Caderno de erros',
      });
      setFeedback('Flashcard criado a partir deste erro.');
    } catch (cause) {
      setFeedback(cause instanceof Error && cause.message === 'card-duplicate' ? 'Esse flashcard já existe.' : cause instanceof Error ? cause.message : String(cause));
    }
  }
  async function remove(row: ErrorNotebookRow) { if (row.kind !== 'manual') return; await deleteManualError(getSupabaseClient(), row.id); await refresh(); }

  return <>
    <button className="error-launcher" onClick={() => setOpen(true)}><span>!</span> Caderno de erros</button>
    {open ? <div className="manager-overlay error-overlay"><div className="manager-overlay-bar"><div><strong>Caderno de erros</strong><small>Erros de cartões entram automaticamente</small></div><button onClick={() => setOpen(false)}>Voltar aos estudos ×</button></div>
      <div className="page-wrap error-page"><div className="page-header"><div><span className="page-eyebrow">REVISÃO INTELIGENTE</span><h1>Caderno de erros</h1><p>Priorize os pontos em que você falhou e encerre cada pendência apenas quando dominar a correção.</p></div><button className="primary-action" onClick={() => setManualOpen(true)}>+ Anotação manual</button></div>
        <div className="error-toolbar"><div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar erro, fundamento ou correção" /></div><label><span>Tipo de erro</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | ErrorCategory)}><option value="all">Todos</option>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} /> Mostrar resolvidos</label></div>
        <div className="error-summary"><div><strong>{rows.filter((row) => !row.resolved).length}</strong><span>pendências abertas</span></div><div><strong>{rows.filter((row) => row.kind === 'card' && !row.resolved).length}</strong><span>vindas de cartões</span></div><div><strong>{rows.filter((row) => row.kind === 'question' && !row.resolved).length}</strong><span>vindas de questões</span></div></div>{feedback ? <p className="import-status">{feedback}</p> : null}
        {loading ? <div className="study-empty">Carregando caderno…</div> : !filtered.length ? <div className="empty-feature"><div className="empty-icon">✓</div><h2>Nenhuma pendência neste filtro.</h2><p>Erros marcados durante o estudo aparecerão automaticamente aqui.</p></div> : <div className="error-list">{filtered.map((row) => { const subject = workspace.subjects.find((item) => item.id === row.subject_id); const topic = workspace.topics.find((item) => item.id === row.topic_id); return <article key={row.id} className={`error-card ${row.resolved ? 'resolved' : ''}`}><div className="error-card-head"><div className="error-badges"><span className={`kind kind-${row.kind}`}>{row.kind === 'card' ? 'Flashcard' : row.kind === 'question' ? 'Questão' : row.kind === 'jurisprudence' ? 'Jurisprudência' : 'Manual'}</span>{row.category ? <span className="error-category-badge">{CATEGORY_LABEL[row.category]}</span> : null}{subject ? <span>{subject.name}</span> : null}{topic ? <span>{topic.name}</span> : null}</div><button className={row.resolved ? 'reopen-button' : 'resolve-button'} onClick={() => void toggle(row)}>{row.resolved ? 'Reabrir' : 'Marcar dominado'}</button></div><h2>{row.title}</h2><label className="error-category-select"><span>Classificar erro</span><select value={row.category || ''} onChange={(event) => void changeCategory(row, event.target.value as ErrorCategory | '')}><option value="">Sem classificação</option>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>{row.note ? <div className="error-section"><small>O que aconteceu</small><p>{row.note}</p></div> : null}{row.correction ? <div className="error-section correction"><small>Correção</small><p>{row.correction}</p></div> : null}{row.legal_basis ? <div className="error-section basis"><small>Base legal</small><p>{row.legal_basis}</p></div> : null}<footer><span>Atualizado em {new Date(row.updated_at).toLocaleDateString('pt-BR')}</span><div className="error-footer-actions"><button className="link-button" onClick={() => void createFlashcardFromError(row)}>Criar flashcard</button>{row.kind === 'manual' ? <button className="danger-text" onClick={() => void remove(row)}>Excluir</button> : null}</div></footer></article>; })}</div>}
      </div>
      {manualOpen ? <div className="modal-backdrop"><div className="modal-card"><div className="modal-heading"><div><span className="page-eyebrow">ANOTAÇÃO MANUAL</span><h2>Novo erro</h2></div><button className="modal-close" onClick={() => setManualOpen(false)}>×</button></div><div className="form-grid"><label><span>Disciplina</span><select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(''); }}><option value="">Sem disciplina</option>{workspace.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span>Assunto</span><select value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Sem assunto</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label><span>Tipo de erro</span><select value={manualCategory} onChange={(event) => setManualCategory(event.target.value as ErrorCategory | '')}><option value="">Sem classificação</option>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="full"><span>Título *</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="full"><span>O que eu errei</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label><label className="full"><span>Correção</span><textarea rows={4} value={correction} onChange={(event) => setCorrection(event.target.value)} /></label><label className="full"><span>Base legal</span><input value={legalBasis} onChange={(event) => setLegalBasis(event.target.value)} /></label></div><div className="modal-actions"><button className="secondary-outline" onClick={() => setManualOpen(false)}>Cancelar</button><button className="primary-action" disabled={!title.trim()} onClick={() => void createManual()}>Salvar erro</button></div></div></div> : null}
    </div> : null}
  </>;
}
