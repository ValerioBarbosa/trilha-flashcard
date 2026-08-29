import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { useStudyWorkspace } from '../study/useStudyWorkspace';
import { importCards, markImportDuplicates, type ImportCandidate } from './card-manager-repository';
import { parsePdfImport } from './pdf-import';
import './pdf-import.css';

export function PdfImportLauncher({ user }: { user: User }) {
  const workspace = useStudyWorkspace(user);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [deckId, setDeckId] = useState('');
  const [rows, setRows] = useState<ImportCandidate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveSubject = subjectId || workspace.subjects[0]?.id || '';
  const availableDecks = workspace.decks.filter((deck) => !effectiveSubject || deck.subject_id === effectiveSubject);
  const effectiveDeck = deckId || availableDecks[0]?.id || '';

  async function parse(file: File) {
    if (!workspace.profile || !effectiveSubject || !effectiveDeck) return;
    setBusy(true); setStatus('Lendo PDF…'); setRows([]);
    try {
      const parsed = await parsePdfImport(file, { subjects: workspace.subjects, topics: workspace.topics, decks: workspace.decks, defaultSubjectId: effectiveSubject, defaultDeckId: effectiveDeck });
      const marked = await markImportDuplicates(getSupabaseClient(), workspace.profile.id, parsed);
      setRows(marked);
      setStatus(`${marked.length} cartões encontrados · ${marked.filter((row) => row.duplicate).length} duplicados bloqueados.`);
    } catch (cause) {
      setStatus(`Não foi possível processar o PDF: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!workspace.profile) return;
    setBusy(true);
    try {
      const result = await importCards(getSupabaseClient(), user, workspace.profile.id, rows);
      setStatus(`${result.inserted} cartões importados · ${result.duplicates} duplicados ignorados · ${result.failed} falhas.`);
      await workspace.refresh();
      setRows(await markImportDuplicates(getSupabaseClient(), workspace.profile.id, rows));
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="pdf-import-launcher" onClick={() => setOpen(true)}><span>PDF</span> Importar PDF</button>
      {open ? <div className="modal-backdrop"><div className="modal-card import-modal"><div className="modal-heading"><div><span className="page-eyebrow">PDF → FLASHCARDS</span><h2>Importar cartões do PDF</h2><p>Selecione a disciplina padrão. O sistema tenta reconhecer rótulos como Pergunta, Resposta, Assunto, Base legal, Pegadinha e Mnemônico.</p></div><button className="modal-close" onClick={() => setOpen(false)}>×</button></div>
        <div className="form-grid pdf-defaults"><label><span>Disciplina padrão *</span><select value={effectiveSubject} onChange={(event) => { setSubjectId(event.target.value); setDeckId(''); }}><option value="">Selecione</option>{workspace.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span>Baralho padrão *</span><select value={effectiveDeck} onChange={(event) => setDeckId(event.target.value)}><option value="">Selecione</option>{availableDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label></div>
        <label className="file-drop pdf-drop"><input type="file" accept="application/pdf,.pdf" disabled={busy || !effectiveDeck} onChange={(event) => event.target.files?.[0] && void parse(event.target.files[0])} /><strong>{busy ? 'Processando…' : 'Escolher arquivo PDF'}</strong><span>O arquivo é processado no navegador; o PDF original não é enviado ao banco.</span></label>
        {status ? <p className="import-status">{status}</p> : null}
        {rows.length ? <div className="import-preview"><div className="import-preview-head"><strong>Pré-visualização</strong><span>{rows.filter((row) => !row.duplicate).length} aptos para importar</span></div>{rows.slice(0,100).map((row) => <div className={`import-row ${row.duplicate ? 'duplicate' : ''}`} key={row.row}><span>{row.row}</span><div><strong>{row.front || 'Pergunta vazia'}</strong><small>{row.back || 'Resposta vazia'}</small>{row.duplicateReason ? <em>{row.duplicateReason}</em> : null}</div><span>{row.duplicate ? 'Duplicado' : 'Novo'}</span></div>)}</div> : null}
        <div className="modal-actions"><button className="secondary-outline" onClick={() => setOpen(false)}>Fechar</button><button className="primary-action" disabled={busy || !rows.some((row) => !row.duplicate)} onClick={() => void confirm()}>Importar válidos</button></div>
      </div></div> : null}
    </>
  );
}
