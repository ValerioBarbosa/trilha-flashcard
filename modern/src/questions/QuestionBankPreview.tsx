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
  source_url: string | null;
  subject_id: string | null;
  topic_id: string | null;
  tags: string[] | null;
};

type Props = { user: User | null; onClose: () => void };

const DEMO_QUESTION: Question = {
  id: 'demo-gran-q4005329',
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
  source: 'Gran Questões',
  source_url: null,
  subject_id: null,
  topic_id: null,
  tags: ['constitucional', 'poder-constituinte'],
};

function normalizeAlternatives(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(String);
  return [];
}

export function QuestionBankPreview({ user, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [board, setBoard] = useState('all');
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      if (!user) {
        setQuestions([]);
        setSelectedId(DEMO_QUESTION.id);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await getSupabaseClient()
          .from('questions')
          .select('id,statement,alternatives,correct_answer,explanation,legal_basis,board,exam,exam_year,source,source_url,subject_id,topic_id,tags')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (cancelled) return;

        const rows = (data ?? []) as Question[];
        setQuestions(rows);
        setSelectedId(rows[0]?.id ?? DEMO_QUESTION.id);
      } catch {
        if (cancelled) return;
        setQuestions([]);
        setSelectedId(DEMO_QUESTION.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const pool = questions.length ? questions : [DEMO_QUESTION];
  const sources = useMemo(() => [...new Set(pool.map((item) => item.source).filter(Boolean))] as string[], [pool]);
  const boards = useMemo(() => [...new Set(pool.map((item) => item.board).filter(Boolean))] as string[], [pool]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pool.filter((item) => {
      if (source !== 'all' && item.source !== source) return false;
      if (board !== 'all' && item.board !== board) return false;
      if (!term) return true;
      return [item.statement, item.board, item.exam, item.source, ...(item.tags || [])]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [pool, search, source, board]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || pool[0];
  const alternatives = normalizeAlternatives(selected?.alternatives);
  const correct = selected?.correct_answer?.trim().toUpperCase() || null;
  const answered = answer !== null;

  useEffect(() => { setAnswer(null); }, [selected?.id]);

  return (
    <div className="qb-shell">
      <header className="qb-topbar">
        <div><strong>Questões</strong><span>{questions.length ? `${questions.length} do seu banco` : 'Modo demonstração'}</span></div>
        <button type="button" onClick={onClose}>Voltar à Trilha ×</button>
      </header>

      <div className="qb-layout">
        <aside className="qb-filters">
          <h2>Filtros</h2>
          <label><span>Busca</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Enunciado, banca, prova…" /></label>
          <label><span>Fonte</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Todas</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Banca</span><select value={board} onChange={(event) => setBoard(event.target.value)}><option value="all">Todas</option>{boards.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <div className="qb-source-policy"><strong>Fonte externa</strong><p>O Trilha guarda a origem, o identificador e o link. Conteúdo de terceiros só entra quando houver uso autorizado ou importação feita pelo usuário.</p></div>
        </aside>

        <section className="qb-list" aria-label="Lista de questões">
          <div className="qb-list-head"><strong>{filtered.length} questões</strong><span>{loading ? 'Atualizando…' : 'Mais recentes'}</span></div>
          {filtered.map((item) => (
            <button key={item.id} className={item.id === selected?.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
              <div><strong>{item.board || 'Sem banca'} · {item.exam_year || '—'}</strong><small>{item.exam || item.source || 'Questão cadastrada'}</small></div>
              <p>{item.statement}</p><span>{item.source || 'Trilha'}</span>
            </button>
          ))}
        </section>

        <main className="qb-question">
          {!selected ? <div className="qb-empty">Nenhuma questão encontrada.</div> : <>
            <div className="qb-question-head"><div className="qb-pills"><span>{selected.source || 'Trilha'}</span><span>{selected.board || 'Sem banca'}</span><span>{selected.exam_year || 'Ano —'}</span></div>{selected.source_url ? <a href={selected.source_url} target="_blank" rel="noreferrer">Abrir na fonte ↗</a> : null}</div>
            <h1>{selected.statement}</h1>
            <div className="qb-alternatives">
              {alternatives.map((alternative, index) => {
                const letter = String.fromCharCode(65 + index);
                const isSelected = answer === letter;
                const isCorrect = answered && correct === letter;
                const isWrong = answered && isSelected && correct !== letter;
                return <button key={`${selected.id}-${letter}`} className={`${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => setAnswer(letter)} disabled={answered}><span>{letter}</span><p>{alternative}</p></button>;
              })}
            </div>
            {answered ? <div className={`qb-result ${answer === correct ? 'success' : 'error'}`}><strong>{answer === correct ? 'Resposta correta' : `Resposta incorreta · gabarito ${correct || 'não informado'}`}</strong>{selected.explanation ? <p>{selected.explanation}</p> : null}{selected.legal_basis ? <small>{selected.legal_basis}</small> : null}</div> : null}
          </>}
        </main>

        <aside className="qb-reference">
          <h2>Fonte e referência</h2>
          <dl><div><dt>Fonte</dt><dd>{selected?.source || 'Trilha'}</dd></div><div><dt>ID externo</dt><dd>{selected?.id || '—'}</dd></div><div><dt>Banca</dt><dd>{selected?.board || '—'}</dd></div><div><dt>Prova</dt><dd>{selected?.exam || '—'}</dd></div><div><dt>Ano</dt><dd>{selected?.exam_year || '—'}</dd></div></dl>
          <div className="qb-note"><strong>Como fica no banco</strong><code>source_provider · external_id · source_url · banca · prova · ano · disciplina · assunto</code></div>
          {!questions.length ? <div className="qb-demo-warning"><strong>Demonstração</strong><span>A questão exibida é ilustrativa. Nenhum conteúdo do Gran foi copiado para o banco.</span></div> : null}
        </aside>
      </div>
    </div>
  );
}
