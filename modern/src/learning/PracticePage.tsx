import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { PRACTICE_BANK, scorePractice, type PracticeQuestion } from './practice-bank';
import { savePracticeAttempt } from './practice-repository';

export function PracticePage({ cases, discipline, user, profileId, subjects = [] }: { cases:boolean; discipline:string; user?:User; profileId?:string; subjects?:Array<{id:string;name:string}> }) {
  const bank = useMemo(() => PRACTICE_BANK.filter((question) => (discipline === 'all' || question.discipline === discipline || cases && discipline === 'study-case') && (!cases || question.rubric)), [discipline,cases]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string,number>>(new Map());
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [caseHistoryCount, setCaseHistoryCount] = useState(0);
  const attempt = useRef<{id:string; answer:number; responseMs:number} | null>(null);
  const started = useRef(Date.now());
  const question = bank[index];
  const score = scorePractice(answers, bank);
  const caseDraftKey = question ? `trilha-case-draft:${profileId || 'visitor'}:${question.id}` : '';
  const caseHistoryKey = `trilha-case-history:${profileId || 'visitor'}`;

  useEffect(() => {
    if (!cases || !question) return;
    try { setDraft(localStorage.getItem(caseDraftKey) || ''); } catch { setDraft(''); }
    started.current = Date.now();
    setElapsedMs(0);
  }, [cases, question?.id]);

  useEffect(() => {
    if (!cases || !question || revealed) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started.current), 1000);
    return () => window.clearInterval(timer);
  }, [cases, question?.id, revealed]);

  useEffect(() => {
    if (!cases || !question) return;
    try { draft.trim() ? localStorage.setItem(caseDraftKey, draft) : localStorage.removeItem(caseDraftKey); } catch { /* local draft */ }
  }, [cases, question?.id, draft]);

  useEffect(() => {
    if (!cases) return;
    try {
      const history = JSON.parse(localStorage.getItem(caseHistoryKey) || '[]');
      setCaseHistoryCount(Array.isArray(history) ? history.length : 0);
    } catch { setCaseHistoryCount(0); }
  }, [cases, profileId]);

  function storeCaseHistory() {
    if (!cases || !question || !revealed) return;
    try {
      const history = JSON.parse(localStorage.getItem(caseHistoryKey) || '[]');
      const rows = Array.isArray(history) ? history : [];
      rows.unshift({
        questionId: question.id,
        subject: question.subject,
        topic: question.topic,
        draft,
        criteria: checked.length,
        totalCriteria: question.rubric?.length || 0,
        elapsedMs,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(caseHistoryKey, JSON.stringify(rows.slice(0, 50)));
      localStorage.removeItem(caseDraftKey);
      setCaseHistoryCount(Math.min(rows.length, 50));
    } catch { /* local history */ }
  }

  function formatElapsed(ms:number) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  async function record(question:PracticeQuestion) {
    if (!attempt.current || !user || !profileId) return;
    setSaving(true); setSaveError('');
    try {
      await savePracticeAttempt(getSupabaseClient(), user, profileId, question, { answer:attempt.current.answer, attemptId:attempt.current.id, responseMs:attempt.current.responseMs, subjectId:subjects.find((subject) => subject.name === question.subject)?.id });
      setSaved(true);
    } catch { setSaveError('Resposta corrigida, mas não foi salva na conta. Tente salvar novamente antes de avançar.'); }
    finally { setSaving(false); }
  }
  function answer(option:number) {
    if (answers.has(question.id)) return;
    setAnswers((current) => new Map(current).set(question.id,option));
    attempt.current = { id:crypto.randomUUID(), answer:option, responseMs:Date.now() - started.current };
    void record(question);
  }
  function next() {
    storeCaseHistory();
    setIndex((current) => current+1); setDraft(''); setRevealed(false); setChecked([]); setSaveError(''); setSaved(false); attempt.current = null; started.current = Date.now();
  }
  if (!bank.length) return <section className="panel-card"><h2>Sem exercícios neste filtro</h2><p>Escolha outra disciplina. O banco autoral é complementar e ainda não cobre todos os tópicos.</p></section>;
  if (!question) return <section className="panel-card"><h2>Sessão concluída</h2><p>{cases ? 'Revise os fundamentos que faltaram em suas respostas. O checklist não é uma nota oficial da banca.' : `${score.correct}/${score.total} acertos · ${score.accuracy ?? '—'}%. Resultado de questões autorais desta sessão, não previsão de nota FCC.`}</p><button className="primary-action" onClick={() => { setIndex(0); setAnswers(new Map()); started.current = Date.now(); }}>Reiniciar treino</button></section>;
  const chosen = answers.get(question.id);
  const canAdvance = cases ? revealed : chosen !== undefined;
  return <section className="panel-card practice-card">
    <span className="panel-label">{cases ? 'CASO AUTORAL · RESPOSTA ESCRITA' : 'QUESTÃO AUTORAL · CINCO ALTERNATIVAS'}</span>
    <p>{index+1}/{bank.length} · {question.subject} · {question.topic}</p>
    {!cases ? <p>{score.total ? `${score.correct}/${score.total} acertos nesta sessão` : 'Responda antes de consultar a correção.'}</p> : <div className="case-timer-row"><p>Meta sugerida: 10 minutos · histórico local: {caseHistoryCount} tentativa{caseHistoryCount === 1 ? '' : 's'}.</p><strong className={elapsedMs > 600000 ? 'case-timer overtime' : 'case-timer'}>{formatElapsed(elapsedMs)}</strong></div>}
    <h2>{question.statement}</h2>{cases ? <p>Identifique o problema, indique a regra aplicável e conclua com base nos fatos. Justifique por que a alternativa inicialmente cogitada seria correta ou incorreta, sem consultar o espelho.</p> : null}
    {cases ? <><label className="learning-draft"><span>Sua resposta fundamentada</span><textarea rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={revealed} placeholder="Problema → fundamento → aplicação aos fatos → conclusão" /><small>Rascunho salvo automaticamente neste dispositivo.</small></label><button className="primary-action" disabled={!draft.trim() || revealed} onClick={() => setRevealed(true)}>Comparar com o espelho</button></> : <div className="practice-options">{question.options.map((option,i) => <button key={i} disabled={chosen !== undefined} className={chosen === undefined ? '' : i === question.answer ? 'practice-correct' : i === chosen ? 'practice-wrong' : ''} onClick={() => answer(i)}>{'ABCDE'[i]}) {option}</button>)}</div>}
    {(cases ? revealed : chosen !== undefined) ? <div className="practice-feedback" role="status">
      <h3>{cases ? 'Espelho de resposta' : chosen === question.answer ? 'Resposta correta' : `Resposta incorreta · gabarito ${'ABCDE'[question.answer]}`}</h3><p>{question.explanation}</p><p><strong>Fundamento:</strong> {question.basis}</p>
      {question.source ? <a href={question.source} target="_blank" rel="noreferrer">Conferir fonte oficial ↗</a> : <p>Exercício autoral de linguagem ou raciocínio; não é reprodução de questão oficial.</p>}
      {cases ? <><h4>Confira o que apareceu na sua resposta</h4>{question.rubric?.map((item) => <label className="learning-check" key={item}><input type="checkbox" checked={checked.includes(item)} onChange={(event) => setChecked((current) => event.target.checked ? [...current,item] : current.filter((value) => value !== item))} />{item}</label>)}<p>{checked.length}/{question.rubric?.length} critérios reconhecidos por você · {question.rubric?.length ? Math.round(checked.length / question.rubric.length * 100) : 0}% do espelho. Autoavaliação; não equivale a nota da FCC.</p></> : null}
    </div> : null}
    {!user ? <p>Modo de exploração: respostas e textos ficam somente nesta sessão. Entre na conta para registrar questões objetivas.</p> : cases ? <p>Seu texto é um rascunho desta sessão. Copie-o antes de sair; a autoavaliação não entra no percentual de acertos.</p> : saved ? <p>Resposta registrada na conta. Erros alimentam o caderno de erros.</p> : null}
    {saveError ? <div className="notice error" role="alert"><span>{saveError}</span><button disabled={saving} onClick={() => void record(question)}>Salvar novamente</button></div> : null}
    <button className="secondary-outline" disabled={!canAdvance || saving || Boolean(saveError)} onClick={next}>{saving ? 'Salvando…' : index+1 === bank.length ? 'Concluir sessão' : 'Próximo exercício →'}</button>
  </section>;
}
