import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import './question-bank-preview.css';

type Question = {
  id: string;
  statement: string;
  alternatives: unknown;
  correct_answer: string | null;
  explanation: string | null;
  legal_basis: string | null;
  board: string | null;
  exam: string | null;
  exam_year: number | null;
  source: string | null;
  source_provider: string | null;
  external_id: string | null;
  source_url: string | null;
  subject_id: string | null;
  topic_id: string | null;
  tags: string[];
};

type Props = { user: User | null; onClose: () => void };

const DEMO_QUESTION: Question = {
  id: 'demo-question',
  statement: 'Sobre o poder constituinte, assinale a alternativa correta.',
  alternatives: [
    'O poder constituinte originário cria uma nova Constituição e não se subordina juridicamente à ordem constitucional anterior.',
    'O poder constituinte derivado reformador pode ser exercido por qualquer órgão estatal sem observar o procedimento constitucional.',
    'O poder constituinte originário é limitado pelas cláusulas pétreas da Constituição anterior.',
    'O poder constituinte derivado decorrente pode afastar livremente os direitos fundamentais previstos na Constituição Federal.',
    'O poder constituinte originário é exercido pelos Estados-membros para edição das Constituições estaduais.',
  ],
  correct_answer: 'A',
  explanation: 'Exemplo demonstrativo criado apenas para validar a experiência visual e o fluxo do módulo.',
  legal_basis: 'Conteúdo demonstrativo — não substitui a fonte oficial da questão.',
  board: 'FGV',
  exam: 'Exemplo de prova',
  exam_year: 2024,
  source: 'Demonstração Trilha',
  source_provider: 'manual',
  external_id: 'demo-001',
  source_url: null,
  subject_id: null,
  topic_id: null,
  tags: ['constitucional', 'poder-constituinte'],
};

function normalizeAlternatives(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : String((item as { text?: unknown })?.text ?? ''));
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(String);
  return [];
}

export function QuestionBankPreview({ user, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [board, setBoard] = useState('all');
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      if (!user) {
        setQuestions([]);
        setProfileId(null);
        setSelectedId(DEMO_QUESTION.id);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const client = getSupabaseClient();
        const { data: profiles, error: profileError } = await client
          .from('study_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('created_at')
          .limit(1);
        if (profileError) throw profileError;
        const activeProfileId = profiles?.[0]?.id ?? null;
        if (!activeProfileId) throw new Error('Nenhum perfil de estudos disponível.');

        const { data, error } = await client
          .from('questions')
          .select('id,statement,alternatives,correct_answer,explanation,legal_basis,board,exam,exam_year,source,source_provider,external_id,source_url,subject_id,topic_id,tags')
          .eq('profile_id', activeProfileId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (cancelled) return;

        const rows = (data ?? []) as Question[];
        setProfileId(activeProfileId);
        setQuestions(rows);
        setSelectedId(rows[0]?.id ?? DEMO_QUESTION.id);
      } catch {
        if (cancelled) return;
        setQuestions([]);
        setProfileId(null);
        setSelectedId(DEMO_QUESTION.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadQuestions();
    return () => { cancelled = true; };
  }, [user]);

  const pool = useMemo(() => (questions.length ? questions : [DEMO_QUESTION]), [questions]);
  const sources = useMemo(() => [...new Set(pool.map((item) => item.source_provider || item.source).filter(Boolean))] as string[], [pool]);
  const boards = useMemo(() => [...new Set(pool.map((item) => item.board).filter(Boolean))] as string[], [pool]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pool.filter((item) => {
      const provider = item.source_provider || item.source || 'Trilha';
      if (source !== 'all' && provider !== source) return false;
      if (board !== 'all' && item.board !== board) return false;
      if (!term) return true;
      return [item.statement, item.board, item.exam, item.source, item.source_provider, item.external_id, ...item.tags]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [pool, search, source, board]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || pool[0];
  const alternatives = normalizeAlternatives(selected?.alternatives);
  const correct = selected?.correct_answer?.trim().toUpperCase() || null;
  const answered = answer !== null;
  const provider = selected?.source_provider || selected?.source || 'Trilha';

  useEffect(() => {
    setAnswer(null);
    setSaveError(null);
    setStartedAt(Date.now());
  }, [selected?.id]);

  async function answerQuestion(letter: string) {
    if (answered || saving || !selected) return;
    setAnswer(letter);
    setSaveError(null);

    if (!user || !profileId || selected.id === DEMO_QUESTION.id) return;
    setSaving(true);
    try {
      const isCorrect = correct ? letter === correct : false;
      const { error } = await getSupabaseClient().from('question_attempts').insert({
        user_id: user.id,
        profile_id: profileId,
        question_id: selected.id,
        answer: letter,
        is_correct: isCorrect,
        response_ms: Date.now() - startedAt,
      });
      if (error) throw error;
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qb-shell">
      <header className="qb-topbar">
        <div><strong>Questões</strong><span>{questions.length ? `${questions.length} do perfil atual` : 'Modo demonstração'}</span></div>
        <button type="button" onClick={onClose}>Voltar à Trilha ×</button>
      </header>

      <div className="qb-layout">
        <aside className="qb-filters">
          <h2>Filtros</h2>
          <label><span>Busca</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Enunciado, banca, prova, ID…" /></label>
          <label><span>Fonte</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Todas</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Banca</span><select value={board} onChange={(event) => setBoard(event.target.value)}><option value="all">Todas</option>{boards.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <div className="qb-source-policy"><strong>Fonte externa</strong><p>O Trilha guarda origem, identificador e link. Conteúdo de terceiros só entra quando houver uso autorizado ou importação feita pelo usuário.</p></div>
        </aside>

        <section className="qb-list" aria-label="Lista de questões">
          <div className="qb-list-head"><strong>{filtered.length} questões</strong><span>{loading ? 'Atualizando…' : 'Mais recentes'}</span></div>
          {filtered.map((item) => (
            <button key={item.id} className={item.id === selected?.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
              <div><strong>{item.board || 'Sem banca'} · {item.exam_year || '—'}</strong><small>{item.exam || item.source || 'Questão cadastrada'}</small></div>
              <p>{item.statement}</p><span>{item.source_provider || item.source || 'Trilha'}</span>
            </button>
          ))}
        </section>

        <main className="qb-question">
          {!selected ? <div className="qb-empty">Nenhuma questão encontrada.</div> : <>
            <div className="qb-question-head"><div className="qb-pills"><span>{provider}</span><span>{selected.board || 'Sem banca'}</span><span>{selected.exam_year || 'Ano —'}</span></div>{selected.source_url ? <a href={selected.source_url} target="_blank" rel="noreferrer">Abrir na fonte ↗</a> : null}</div>
            <h1>{selected.statement}</h1>
            <div className="qb-alternatives">
              {alternatives.map((alternative, index) => {
                const letter = String.fromCharCode(65 + index);
                const isSelected = answer === letter;
                const isCorrect = answered && correct === letter;
                const isWrong = answered && isSelected && correct !== letter;
                return <button key={`${selected.id}-${letter}`} className={`${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => void answerQuestion(letter)} disabled={answered || saving}><span>{letter}</span><p>{alternative}</p></button>;
              })}
            </div>
            {answered ? <div className={`qb-result ${answer === correct ? 'success' : 'error'}`}><strong>{answer === correct ? 'Resposta correta' : `Resposta incorreta · gabarito ${correct || 'não informado'}`}</strong>{selected.explanation ? <p>{selected.explanation}</p> : null}{selected.legal_basis ? <small>{selected.legal_basis}</small> : null}</div> : null}
            {saveError ? <div className="qb-result error"><strong>Não foi possível registrar a tentativa.</strong><p>{saveError}</p></div> : null}
          </>}
        </main>

        <aside className="qb-reference">
          <h2>Fonte e referência</h2>
          <dl><div><dt>Fonte</dt><dd>{provider}</dd></div><div><dt>ID externo</dt><dd>{selected?.external_id || '—'}</dd></div><div><dt>Banca</dt><dd>{selected?.board || '—'}</dd></div><div><dt>Prova</dt><dd>{selected?.exam || '—'}</dd></div><div><dt>Ano</dt><dd>{selected?.exam_year || '—'}</dd></div></dl>
          <div className="qb-note"><strong>Identidade da questão</strong><code>source_provider · external_id · source_url</code></div>
          {!questions.length ? <div className="qb-demo-warning"><strong>Demonstração</strong><span>A questão exibida é ilustrativa e criada pelo próprio Trilha.</span></div> : null}
        </aside>
      </div>
    </div>
  );
}
