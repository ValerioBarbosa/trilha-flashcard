import { useEffect, useMemo, useState } from 'react';
import { isStudyContent } from '@core/features/study/card-purpose';
import { loadStudyCatalogCards, type CompleteCatalogCard } from '../study/builtin-seed';
import { PageHeader } from '../shared/PageHeader';
import { PRACTICE_BANK, SOURCES } from './practice-bank';
import { PracticePage } from './PracticePage';
import type { User } from '@supabase/supabase-js';

export type LearningMode = 'learn' | 'practice' | 'cases';
type Props = { mode?: LearningMode; user?: User; profileId?: string; subjects?: Array<{id:string;name:string}>; onReview?: (discipline:string, topic:string) => void; initialSubject?: string; };

export const DISCIPLINES: Record<string, string> = {
  'labor-procedure':'Direito Processual do Trabalho', 'labor-law':'Direito do Trabalho',
  portuguese:'Português', constitutional:'Direito Constitucional', administrative:'Direito Administrativo',
  'civil-procedure':'Direito Processual Civil', 'trt-legislation':'Regimento/Legislação TRT',
  'math-logic':'Matemática + RLM', 'lgpd-digital':'LGPD e Direito Digital', 'study-case':'Estudo de Caso Jurídico',
};

export function LearningPage({ mode = 'learn', user, profileId, subjects, onReview, initialSubject = 'all' }: Props) {
  const [active, setActive] = useState<LearningMode>(mode);
  const [discipline, setDiscipline] = useState(initialSubject);
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<CompleteCatalogCard[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setActive(mode); }, [mode]);
  useEffect(() => { setDiscipline(initialSubject); }, [initialSubject]);
  useEffect(() => {
    let disposed = false;
    loadStudyCatalogCards().then((rows) => { if (!disposed) { setCards(rows); setLoaded(true); } }).catch(() => { if (!disposed) setError('Não foi possível carregar o conteúdo. Confira a conexão e reabra esta página.'); });
    return () => { disposed = true; };
  }, []);
  const lessons = useMemo(() => cards.filter((card) => card.sourceLayer === 'Camada 3 - Fechamento do edital' && (discipline === 'all' || card.discipline === discipline) && `${card.topic} ${card.back} ${card.legalBasis}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [cards, discipline, query]);
  const byTopic = useMemo(() => {
    const groups = new Map<string, CompleteCatalogCard[]>();
    for (const card of cards) if (isStudyContent(card) && card.type !== 'Revisão de regra' && card.type !== 'Pegadinha FCC') {
      const key = `${card.discipline}|${card.topic}`;
      groups.set(key, [...(groups.get(key) || []), card]);
    }
    return groups;
  }, [cards]);
  return <div className="page-wrap learning-page">
    <PageHeader eyebrow="APRENDER → PRATICAR → REVISAR" title="Estudo guiado" subtitle="Material autoral baseado na matriz de preparação. Os pesos de 2022 são referência histórica; o novo edital poderá alterar a matriz." />
    <div className="learning-tabs" role="group" aria-label="Etapas do estudo">
      <button className={active === 'learn' ? 'primary-action' : 'secondary-outline'} onClick={() => setActive('learn')}>Aprender</button>
      <button className={active === 'practice' ? 'primary-action' : 'secondary-outline'} onClick={() => setActive('practice')}>Questões</button>
      <button className={active === 'cases' ? 'primary-action' : 'secondary-outline'} onClick={() => setActive('cases')}>Estudo de Caso</button>
    </div>
    <label className="learning-filter"><span>Disciplina</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="all">Todas as disciplinas</option>{Object.entries(DISCIPLINES).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {active !== 'learn' ? <PracticePage key={`${profileId || 'visitor'}|${active}|${discipline}`} cases={active === 'cases'} discipline={discipline} user={user} profileId={profileId} subjects={subjects} /> : <>
      <section className="panel-card"><h2>Sua sessão de três horas</h2><p>75 min de teoria e fonte legal · 60 min de questões e correção · 30 min de recuperação sem consulta · 15 min de pausas distribuídas.</p><p>Leia o roteiro, estude o conteúdo e responda sem olhar. Nos cartões, marque “Bom” somente se conseguiu explicar a resposta; reconhecer o texto não basta.</p></section>
      <div className="search-field"><input aria-label="Buscar assunto no estudo guiado" placeholder="Buscar assunto ou artigo" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {error ? <div className="notice error" role="alert">{error}</div> : !loaded ? <p>Carregando roteiros e conteúdo…</p> : <p>{lessons.length} assuntos neste filtro. Um roteiro disponível não significa conteúdo dominado.</p>}
      {loaded && !lessons.length ? <p>Sem roteiro neste filtro. Escolha outra disciplina ou veja os exercícios disponíveis.</p> : null}
      {lessons.map((lesson) => {
        const contents = byTopic.get(`${lesson.discipline}|${lesson.topic}`) || [];
        const exercises = PRACTICE_BANK.filter((question) => question.discipline === lesson.discipline);
        return <details key={lesson.id} className="panel-card learning-lesson"><summary><small>{DISCIPLINES[lesson.discipline]}</small><strong>{lesson.topic}</strong><span>{contents.length ? `${contents.length} cartões de conteúdo` : 'Leitura pela fonte necessária'}</span></summary>
          <h3>Roteiro de leitura</h3><p>{lesson.back}</p><p><strong>Referência:</strong> {lesson.legalBasis || 'Estudo de texto e resolução de exercícios'}</p>
          {contents.length ? <><h3>Conteúdo para recuperação</h3>{contents.map((card) => <article className="learning-rule" key={card.id}><h4>{card.front}</h4><p>{card.back}</p>{card.legalBasis ? <small>{card.legalBasis}</small> : null}{card.trap ? <p><strong>Atenção:</strong> {card.trap}</p> : null}</article>)}</> : <p className="notice">Este assunto tem roteiro, mas ainda não tem cartões substantivos neste bloco. Estude pela fonte indicada e acrescente perguntas específicas em Cartões.</p>}
          <div className="learning-tabs">{onReview && contents.length ? <button className="primary-action" onClick={() => onReview(lesson.discipline, lesson.topic || '')}>Revisar este assunto</button> : null}{exercises.length ? <button className="secondary-outline" onClick={() => { setDiscipline(lesson.discipline); setActive('practice'); }}>Questões desta disciplina</button> : null}</div>
          <SourceLinks discipline={lesson.discipline} />
        </details>;
      })}
      <section className="panel-card"><h2>Fontes de leitura</h2><p>Os resumos não substituem a leitura do dispositivo ou precedente completo. Consulte a versão consolidada e o contexto temporal.</p><SourceLinks discipline="all" /></section>
    </>}
  </div>;
}

function SourceLinks({ discipline }: { discipline:string }) {
  const links = discipline === 'all' ? Object.entries(SOURCES) : discipline === 'labor-law' || discipline === 'labor-procedure' ? [['CLT',SOURCES.clt],['Constituição',SOURCES.cf],['Jurisprudência TST',SOURCES.tst]] : discipline === 'civil-procedure' ? [['CPC',SOURCES.cpc]] : discipline === 'constitutional' ? [['Constituição',SOURCES.cf]] : discipline === 'trt-legislation' ? [['Lei 8.112',SOURCES.servidor],['Regimento TRT-4',SOURCES.regimento],['Lei 9.784',SOURCES.processo]] : discipline === 'administrative' ? [['Lei 9.784',SOURCES.processo],['Constituição',SOURCES.cf]] : discipline === 'lgpd-digital' ? [['LGPD',SOURCES.lgpd]] : [];
  return <div className="learning-sources">{links.map(([label,url]) => <a key={url} href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>;
}
