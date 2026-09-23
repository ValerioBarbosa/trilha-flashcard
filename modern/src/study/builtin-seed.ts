import type { SupabaseClient, User } from '@supabase/supabase-js';
import legacyDecks from '../generated/legacy-decks.json';

type LegacyCard = Record<string, unknown> & {
  id?: string; front?: string; back?: string; topic?: string; subtopic?: string;
  legalBasis?: string; cardType?: string; type?: string; priority?: string; difficulty?: string;
  tag?: string; tags?: string[]; example?: string; complement?: string; pitfall?: string; mnemonic?: string;
};
type LegacyDeck = { id: string; title: string; sourceNote?: string; topics?: string[]; cards?: LegacyCard[] };
export type BuiltinSeedReport = { decks: number; cards: number; topics: number; duplicatesSkipped: number };

type CompleteCatalogCard = {
  id: string; discipline: string; disciplineName?: string; topic?: string; subtopic?: string;
  legalBasis?: string; type?: string; priority?: string; difficulty?: string;
  front: string; back: string; complement?: string; trap?: string; mnemonic?: string;
  tags?: string[]; level?: string; sourceLayer?: string;
};
type CompleteCatalogFile = { cards: CompleteCatalogCard[] };

const COMPLETE_CATALOG_PARTS = Array.from({ length: 6 }, (_, index) =>
  `data/trt4-ajaj-v3-1077/part-${String(index + 1).padStart(2, '0')}.txt`
);

const COMPLETE_DECK_TITLES: Record<string, string> = {
  'labor-procedure': 'Direito Processual do Trabalho · 17,8%',
  portuguese: 'Português · 16,7%',
  administrative: 'Direito Administrativo · 16,7%',
  'labor-law': 'Direito do Trabalho · 15,6%',
  constitutional: 'Direito Constitucional · 11,1%',
  'civil-procedure': 'Direito Processual Civil · 11,1%',
  'math-logic': 'Matemática + RLM · 5,6%',
  'trt-legislation': 'Regimento/Legislação TRT · 3,3%',
  'lgpd-digital': 'LGPD e Direito Digital · 2,2%',
  'study-case': 'Estudo de Caso Jurídico',
};


const LAYER4_JURISPRUDENCE: Array<[string,string,string,string]> = [
  ['TST Súmulas 6, 51 e 85','Equiparação salarial; regulamento empresarial; compensação de jornada','labor-law','Direito do Trabalho'],
  ['TST Súmulas 100, 128 e 245','Ação rescisória; depósito recursal; prazo do depósito','labor-procedure','Direito Processual do Trabalho'],
  ['TST Súmulas 214 e 414','Decisões interlocutórias; mandado de segurança; tutela','labor-procedure','Direito Processual do Trabalho'],
  ['TST Súmulas 331 e 338','Terceirização e responsabilidade; controles de jornada','labor-law','Direito do Trabalho'],
  ['TST Súmulas 422, 425 e 463','Dialeticidade; jus postulandi; justiça gratuita','labor-procedure','Direito Processual do Trabalho'],
  ['STF Súmula Vinculante 10','Reserva de plenário','constitutional','Direito Constitucional'],
  ['STF ADPF 324 + RE 958.252','Terceirização e divisão do trabalho','labor-law','Direito do Trabalho'],
  ['STF ADI 5.766','Justiça gratuita, honorários e acesso à Justiça','labor-procedure','Direito Processual do Trabalho'],
  ['STF ADC 58/59','Atualização dos créditos trabalhistas','labor-procedure','Direito Processual do Trabalho'],
  ['STF Tema 1.046','Validade da negociação coletiva limitadora de direitos','labor-law','Direito do Trabalho'],
];

const LAYER4_STUDY_CASE: Array<[string,string,string]> = [
  ['Leitura do caso','Na primeira leitura do Estudo de Caso, quais elementos devem ser identificados?','Sujeitos, fatos, pedido, controvérsia e limite da resposta; destaque verbos de comando e dados juridicamente relevantes.'],
  ['Problema jurídico','Como formular o problema jurídico central?','Em uma frase objetiva, delimitando exatamente a controvérsia apresentada, sem responder problema diferente do enunciado.'],
  ['Regra aplicável','O que deve aparecer na etapa de fundamentação do Estudo de Caso?','Constituição, CLT, CPC, lei especial e jurisprudência aplicáveis, com fundamento específico e sem inventar artigo.'],
  ['Aplicação','O que diferencia aplicação de mera citação de norma?','Confrontar cada fato juridicamente relevante com a regra e explicar por que essa regra conduz à solução.'],
  ['Conclusão','Como deve ser a conclusão do Estudo de Caso?','Direta, completa e coerente, respondendo cada comando do enunciado e retomando os pontos solicitados.'],
  ['Revisão final','O que conferir nos minutos finais do Estudo de Caso?','Competência, cabimento, prazo, legitimidade, efeitos, conclusão e correção formal.'],
  ['Processo do Trabalho','Quais eixos devem ser priorizados em Estudos de Caso de Processo do Trabalho?','Competência, recursos, execução, tutela provisória, provas e precedentes.'],
  ['Direito do Trabalho','Quais eixos devem ser priorizados em Estudos de Caso de Direito do Trabalho?','Vínculo, jornada, remuneração, estabilidade, rescisão e responsabilidade.'],
  ['Direito Constitucional','Quais eixos devem ser priorizados em Estudos de Caso de Direito Constitucional?','Direitos fundamentais, Administração Pública e organização da Justiça do Trabalho.'],
  ['Direito Administrativo','Quais eixos devem ser priorizados em Estudos de Caso de Direito Administrativo?','Servidor público, processo administrativo, responsabilidade, improbidade e licitações.'],
  ['Direito Processual Civil','Quais eixos devem ser priorizados em Estudos de Caso de Processo Civil?','Competência, sujeitos, atos, provas, recursos, execução e aplicação subsidiária.'],
  ['Comando da questão','Por que os verbos de comando devem ser marcados antes de escrever?','Porque eles delimitam exatamente o que deve ser respondido e evitam desenvolvimento correto, mas fora do pedido.'],
  ['Fatos relevantes','Todo fato narrado precisa aparecer na resposta?','Não. Devem ser selecionados os fatos juridicamente relevantes para a controvérsia e para os comandos da questão.'],
  ['Fundamento específico','É suficiente escrever “conforme a legislação vigente”?','Não. O protocolo exige fundamento específico e localizado; evite referência vaga e não invente artigo.'],
  ['Regra e exceção','Ao identificar uma regra jurídica, qual verificação vem logo depois?','Verificar requisitos, exceções e consequências aplicáveis aos fatos do caso.'],
  ['Competência','Por que competência deve entrar no checklist final?','Porque uma solução materialmente correta pode estar incompleta se o órgão competente ou a via adequada forem ignorados.'],
  ['Cabimento','O que verificar sobre cabimento antes de concluir?','Se o instrumento, ação, recurso ou medida escolhida é juridicamente adequada à hipótese apresentada.'],
  ['Prazo','Como tratar prazo no Estudo de Caso?','Identifique o prazo aplicável, seu marco inicial e eventual regra especial relevante ao caso.'],
  ['Legitimidade','O que deve ser conferido sobre legitimidade?','Quem pode propor, recorrer, requerer ou figurar no polo pertinente segundo o instituto cobrado.'],
  ['Efeitos','Por que os efeitos jurídicos devem ser explicitados?','Porque a conclusão deve indicar não apenas se a medida é cabível, mas também a consequência jurídica da solução.'],
  ['Estrutura enxuta','Qual é o modelo enxuto recomendado para organizar a resposta?','Questão jurídica → fundamento → aplicação aos fatos → conclusão objetiva para cada comando.'],
  ['Tempo','Qual regra de gestão da prova consta no material-base?','Resolver primeiro as questões seguras, marcar as demoradas e preservar cerca de 55 a 65 minutos para a parte escrita/transcrição.'],
  ['Reescrita','O que fazer com um Estudo de Caso que fique abaixo da meta?','Identificar falhas de fundamento, estrutura e aplicação e reescrever a resposta.'],
  ['Meta base','Qual é a meta escrita da fase Base?','Produzir estrutura completa e localizar corretamente o fundamento.'],
  ['Meta consolidação','Qual é a meta escrita da fase de Consolidação?','Entregar resposta completa dentro do tempo.'],
  ['Meta reta final','Qual é a meta escrita na reta final?','Alcançar 70+ com fundamentação, aplicação e conclusão.'],
];

function buildLayer4Cards(cards: CompleteCatalogCard[]): CompleteCatalogCard[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const key = `${card.discipline}|${card.topic || ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const layer4: CompleteCatalogCard[] = [];
  const officialTopicsByKey = new Map<string, CompleteCatalogCard>();
  for (const card of cards.filter((entry) => entry.sourceLayer === 'Camada 3 - Fechamento do edital')) {
    if (!card.topic) continue;
    officialTopicsByKey.set(`${card.discipline}|${card.topic}`, card);
  }
  const deepestGaps = [...officialTopicsByKey.entries()]
    .sort(([keyA], [keyB]) => (counts.get(keyA) || 0) - (counts.get(keyB) || 0) || keyA.localeCompare(keyB, 'pt-BR'))
    .slice(0, 157)
    .map(([, card]) => card);

  for (const card of deepestGaps) {
    const key = `${card.discipline}|${card.topic || ''}`;
    const tags = ['AJAJ','Edital V3','Nível 4 - Aprofundamento real','TRT4','camada-4','aprofundamento'];
    layer4.push({
      id: `card-trt4-layer4-${stableHash(`${key}|caso`)}`,
      discipline: card.discipline, disciplineName: card.disciplineName, topic: card.topic,
      subtopic: 'Aplicação prática do tópico', legalBasis: card.legalBasis, type: 'Caso prático',
      priority: card.priority, difficulty: 'Difícil',
      front: `Em uma questão prática sobre “${card.topic}”, quais pontos mínimos você deve identificar antes de concluir?`,
      back: card.back,
      complement: 'Camada 4: aprofundamento aplicado ao tópico do edital verticalizado V3.',
      trap: 'A FCC pode apresentar fatos corretos, mas omitir um requisito, exceção, prazo, sujeito ou efeito decisivo. Faça o checklist completo antes de marcar.',
      mnemonic: '', tags: [...tags,'caso-pratico'], level: 'Nível 4 - Aprofundamento real', sourceLayer: 'Camada 4 - Aprofundamento real',
    });
    layer4.push({
      id: `card-trt4-layer4-${stableHash(`${key}|fcc`)}`,
      discipline: card.discipline, disciplineName: card.disciplineName, topic: card.topic,
      subtopic: 'Controle de pegadinha FCC', legalBasis: card.legalBasis, type: 'Pegadinha FCC',
      priority: card.priority, difficulty: 'Difícil',
      front: `Qual é o núcleo que não pode ser perdido numa alternativa da FCC sobre “${card.topic}”?`,
      back: card.back,
      complement: 'Camada 4: recuperação ativa do núcleo de cobrança antes de resolver alternativas.',
      trap: `Desconfie de alternativa que simplifique “${card.topic}” a uma regra absoluta. Procure requisito, exceção e consequência.`,
      mnemonic: '', tags: [...tags,'fcc','pegadinha'], level: 'Nível 4 - Aprofundamento real', sourceLayer: 'Camada 4 - Aprofundamento real',
    });
  }

  for (const [reference, theme, discipline, disciplineName] of LAYER4_JURISPRUDENCE) {
    const tags = ['AJAJ','Edital V3','Nível 4 - Aprofundamento real','TRT4','jurisprudencia-prioritaria'];
    layer4.push({
      id: `card-trt4-layer4-${stableHash(`${reference}|mapa`)}`, discipline, disciplineName,
      topic: 'Jurisprudência prioritária STF/TST', subtopic: reference, legalBasis: reference,
      type: 'Jurisprudência', priority: 'A', difficulty: 'Difícil',
      front: `Qual é o núcleo de cobrança associado a ${reference} no mapa jurisprudencial do TRT-4?`,
      back: `${theme}.`,
      complement: 'Precedente listado expressamente no bloco de jurisprudência prioritária do edital verticalizado V3. Confira vigência, modulação e alterações antes da prova.',
      trap: 'Não memorize apenas o número do precedente: recupere também a hipótese de incidência e sua conexão com o tópico do edital.',
      mnemonic: '', tags, level: 'Nível 4 - Aprofundamento real', sourceLayer: 'Camada 4 - Aprofundamento real',
    });
    layer4.push({
      id: `card-trt4-layer4-${stableHash(`${reference}|controle`)}`, discipline, disciplineName,
      topic: 'Jurisprudência prioritária STF/TST', subtopic: `${reference} - controle de vigência`, legalBasis: reference,
      type: 'Revisão jurisprudencial', priority: 'A', difficulty: 'Difícil',
      front: `Antes de usar ${reference} numa questão, o que deve ser conferido além do número do precedente?`,
      back: `A tese aplicável a ${theme.toLowerCase()}, a hipótese de incidência, a vigência, eventual cancelamento/alteração e eventual modulação.`,
      complement: 'Use o precedente somente depois de confirmar sua situação atual.',
      trap: 'Número correto com tese superada ou aplicada fora da hipótese também leva ao erro.',
      mnemonic: '', tags: [...tags,'vigencia'], level: 'Nível 4 - Aprofundamento real', sourceLayer: 'Camada 4 - Aprofundamento real',
    });
  }

  for (const [subtopic, front, back] of LAYER4_STUDY_CASE) {
    layer4.push({
      id: `card-trt4-layer4-${stableHash(`study-case|${subtopic}`)}`,
      discipline: 'study-case', disciplineName: 'Estudo de Caso Jurídico',
      topic: 'Estudo de Caso Jurídico - protocolo de treino', subtopic,
      legalBasis: 'Edital Verticalizado TRT-4 AJAJ V3, seção 19',
      type: 'Estudo de Caso', priority: 'A', difficulty: 'Difícil', front, back,
      complement: 'Treino transversal para a prova discursiva AJAJ.',
      trap: 'Não confunda conhecer o conteúdo com responder exatamente o que o comando e os fatos exigem.',
      mnemonic: '', tags: ['AJAJ','Edital V3','Nível 4 - Aprofundamento real','TRT4','estudo-de-caso'],
      level: 'Nível 4 - Aprofundamento real', sourceLayer: 'Camada 4 - Aprofundamento real',
    });
  }
  return layer4;
}

async function loadCompleteCatalogDecks(): Promise<LegacyDeck[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];
  const chunks = await Promise.all(COMPLETE_CATALOG_PARTS.map(async (path) => {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) throw new Error(`builtin-catalog-fetch-failed:${path}:${response.status}`);
    return response.text();
  }));
  const parsed = JSON.parse(chunks.join('\n')) as CompleteCatalogFile;
  const catalogCards = [...(parsed.cards || []), ...buildLayer4Cards(parsed.cards || [])];
  const groups = new Map<string, LegacyDeck>();

  for (const card of catalogCards) {
    const deckId = card.discipline;
    if (!deckId) continue;
    let deck = groups.get(deckId);
    if (!deck) {
      deck = {
        id: deckId,
        title: COMPLETE_DECK_TITLES[deckId] || card.disciplineName || deckId,
        sourceNote: 'Edital Verticalizado TRT-4 AJAJ 2026 V3 · catálogo completo 1.437 cartões · 4 camadas',
        topics: [],
        cards: [],
      };
      groups.set(deckId, deck);
    }
    if (card.topic && !deck.topics!.includes(card.topic)) deck.topics!.push(card.topic);
    deck.cards!.push({
      id: card.id,
      front: card.front,
      back: card.back,
      topic: card.topic,
      subtopic: card.subtopic,
      legalBasis: card.legalBasis,
      type: card.type,
      priority: card.priority,
      difficulty: card.difficulty,
      tags: card.tags,
      complement: card.complement,
      pitfall: card.trap,
      mnemonic: card.mnemonic,
      example: [card.level, card.sourceLayer].filter(Boolean).join(' · '),
    });
  }
  return [...groups.values()];
}

function mergeLegacyDecks(baseDecks: LegacyDeck[], completeDecks: LegacyDeck[]): LegacyDeck[] {
  const completeById = new Map(completeDecks.map((deck) => [deck.id, deck]));
  const merged = baseDecks.map((deck) => completeById.get(deck.id) || deck);
  const existing = new Set(merged.map((deck) => deck.id));
  for (const deck of completeDecks) if (!existing.has(deck.id)) merged.push(deck);
  return merged;
}

function stableHash(value: string): string { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function slugify(value: string): string { const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100); return normalized || `item-${stableHash(value)}`; }
function subjectName(deck: LegacyDeck): string { const title = deck.title?.trim() || deck.id; return title.split('·')[0]?.trim() || title; }
function isOnboardingDeck(deck: LegacyDeck): boolean { return deck.id === 'trt4-overview' || slugify(subjectName(deck)) === 'comece-aqui'; }
function isEmptyDeck(deck: LegacyDeck): boolean { return !(deck.topics || []).length && !(deck.cards || []).length; }
function subjectWeight(deck: LegacyDeck): number | null {
  const match = deck.title?.match(/·\s*([\d.,]+)\s*%\s*$/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
function contentKey(subjectId: string | null, front: string, back: string): string { return `${subjectId || ''}|${front.trim().toLowerCase()}|${back.trim().toLowerCase()}`; }
function normalizedPriority(value: unknown): 'A'|'B'|'C'|null { const v = typeof value === 'string' ? value.trim().toUpperCase() : ''; return v === 'A' || v === 'B' || v === 'C' ? v : null; }
function normalizedDifficulty(value: unknown): 'easy'|'medium'|'hard'|null { const v = typeof value === 'string' ? value.trim().toLowerCase() : ''; if (['easy','facil','fácil'].includes(v)) return 'easy'; if (['medium','medio','médio'].includes(v)) return 'medium'; if (['hard','dificil','difícil'].includes(v)) return 'hard'; return null; }
function tagsFor(card: LegacyCard): string[] { const values = new Set<string>(); if (Array.isArray(card.tags)) card.tags.forEach((tag) => tag && values.add(String(tag).trim())); if (card.tag?.trim()) values.add(card.tag.trim()); if (card.subtopic?.trim()) values.add(card.subtopic.trim()); return [...values].filter(Boolean); }

async function upsertSubject(client: SupabaseClient, user: User, profileId: string, name: string, order: number, weight: number | null) {
  const { data, error } = await client.from('subjects').upsert({ user_id:user.id, profile_id:profileId, name, slug:slugify(name), sort_order:order, weight }, { onConflict:'profile_id,slug' }).select('id').single();
  if (error) throw error; return data.id as string;
}
async function upsertDeck(client: SupabaseClient, user: User, profileId: string, subjectId: string | null, deck: LegacyDeck) {
  const { data, error } = await client.from('decks').upsert({ user_id:user.id, profile_id:profileId, subject_id:subjectId, name:deck.title || deck.id, slug:slugify(deck.id), source:deck.sourceNote || 'Catálogo nativo Trilha Flashcard', is_builtin:true, is_archived:false }, { onConflict:'profile_id,slug' }).select('id').single();
  if (error) throw error; return data.id as string;
}
async function ensureTopics(client: SupabaseClient, user: User, profileId: string, subjectId: string | null, deck: LegacyDeck): Promise<Map<string,string>> {
  if (!subjectId) return new Map();
  const names = new Set<string>();
  (deck.topics || []).forEach((name) => name?.trim() && names.add(name.trim()));
  (deck.cards || []).forEach((card) => card.topic?.trim() && names.add(card.topic.trim()));
  if (!names.size) return new Map();

  const rows = [...names].map((name,index) => {
    const topicCards = (deck.cards || []).filter((card) => card.topic?.trim() === name);
    const baseCard = topicCards.find((card) => card.subtopic?.trim() === 'Base legal e referência')
      || topicCards.find((card) => Array.isArray(card.tags) && card.tags.includes('Nível 1 - Matriz verticalizada'))
      || topicCards[0];
    const focusCard = topicCards.find((card) => card.subtopic?.trim() === 'Núcleo de cobrança');
    return {
      user_id:user.id,
      profile_id:profileId,
      subject_id:subjectId,
      parent_id:null,
      name,
      slug:slugify(name),
      sort_order:index,
      legal_basis: typeof baseCard?.legalBasis === 'string' ? baseCard.legalBasis : null,
      priority: normalizedPriority(baseCard?.priority || focusCard?.priority),
      edital_text: typeof focusCard?.back === 'string' ? focusCard.back : null,
    };
  });
  const { data, error } = await client.from('topics').upsert(rows, { onConflict:'subject_id,parent_id,slug' }).select('id,name');
  if (error) throw error;
  return new Map((data || []).map((row:any) => [row.name,row.id]));
}

type ExistingBuiltinCard = { id: string; deck_id: string; legacy_id: string | null; subject_id: string | null; front: string; back: string };

async function upsertCards(
  client: SupabaseClient,
  user: User,
  profileId: string,
  subjectId: string | null,
  deckId: string,
  deck: LegacyDeck,
  topics: Map<string,string>,
  seen: Set<string>,
  existingBuiltinByContent: Map<string, ExistingBuiltinCard>,
  existingBuiltinByLegacyId: Map<string, ExistingBuiltinCard>,
) {
  const rows:any[] = [];
  const reconcileRows:any[] = [];
  let skipped = 0;

  for (const card of deck.cards || []) {
    const front = card.front?.trim();
    const back = card.back?.trim();
    if (!front || !back) continue;

    const key = contentKey(subjectId, front, back);
    const legacyId = card.id?.trim() || `card-${stableHash(`${deck.id}|${front}|${back}`)}`;
    const canonical = legacyId.startsWith('card-trt4-');
    const row = {
      user_id:user.id,
      profile_id:profileId,
      deck_id:deckId,
      subject_id:subjectId,
      topic_id:subjectId && card.topic ? topics.get(card.topic.trim()) || null : null,
      legacy_id:legacyId,
      front,
      back,
      card_type:typeof card.cardType === 'string' ? card.cardType : typeof card.type === 'string' ? card.type : null,
      legal_basis:typeof card.legalBasis === 'string' ? card.legalBasis : null,
      example:typeof card.example === 'string' ? card.example : null,
      complement:typeof card.complement === 'string' ? card.complement : null,
      pitfall:typeof card.pitfall === 'string' ? card.pitfall : null,
      mnemonic:typeof card.mnemonic === 'string' ? card.mnemonic : null,
      priority:normalizedPriority(card.priority),
      difficulty:normalizedDifficulty(card.difficulty),
      tags:tagsFor(card),
      source:deck.sourceNote || 'Catálogo nativo Trilha Flashcard',
      deleted_at:null,
      suspended:false,
    };

    const existingBuiltin = canonical
      ? existingBuiltinByLegacyId.get(legacyId) || existingBuiltinByContent.get(key)
      : existingBuiltinByContent.get(key);
    if (canonical && existingBuiltin) {
      reconcileRows.push({ id: existingBuiltin.id, ...row });
      seen.add(key);
      continue;
    }

    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }

  for (let start=0; start<reconcileRows.length; start+=100) {
    const { error } = await client.from('cards').upsert(reconcileRows.slice(start,start+100), { onConflict:'id' });
    if (error) throw error;
  }
  for (let start=0; start<rows.length; start+=100) {
    const { error } = await client.from('cards').upsert(rows.slice(start,start+100), { onConflict:'user_id,deck_id,legacy_id' });
    if (error) throw error;
  }
  return { inserted: rows.length, reconciled: reconcileRows.length, skipped };
}

export async function seedBuiltinStudyCatalog(client: SupabaseClient, user: User, profileId: string): Promise<BuiltinSeedReport> {
  const completeDecks = await loadCompleteCatalogDecks();
  const decks = mergeLegacyDecks(legacyDecks as LegacyDeck[], completeDecks);
  const currentBuiltinLegacyIds = new Set(
    decks.flatMap((deck) => (deck.cards || []).map((card) => card.id?.trim()).filter((id): id is string => Boolean(id)))
  );
  const [{ data: existingDecks, error: deckReadError }, { data: existing, error: existingError }] = await Promise.all([
    client.from('decks').select('id,is_builtin').eq('profile_id', profileId),
    client.from('cards').select('id,deck_id,legacy_id,subject_id,front,back').eq('profile_id', profileId).is('deleted_at', null),
  ]);
  if (deckReadError) throw deckReadError;
  if (existingError) throw existingError;
  const builtinDeckIds = new Set((existingDecks || []).filter((row:any) => row.is_builtin).map((row:any) => row.id));
  const seen = new Set<string>((existing || []).map((row:any) => contentKey(row.subject_id, row.front, row.back)));
  const existingBuiltinByContent = new Map<string, ExistingBuiltinCard>();
  const existingBuiltinByLegacyId = new Map<string, ExistingBuiltinCard>();
  for (const row of (existing || []) as ExistingBuiltinCard[]) {
    if (!builtinDeckIds.has(row.deck_id)) continue;
    existingBuiltinByContent.set(contentKey(row.subject_id, row.front, row.back), row);
    if (row.legacy_id) existingBuiltinByLegacyId.set(row.legacy_id, row);
  }
  let seededDecks=0, cards=0, reconciled=0, topics=0, duplicatesSkipped=0, order=0;
  for (const deck of decks) {
    if (!isOnboardingDeck(deck) && isEmptyDeck(deck)) continue;
    let subjectId: string | null = null;
    if (!isOnboardingDeck(deck)) { subjectId = await upsertSubject(client,user,profileId,subjectName(deck),order,subjectWeight(deck)); order += 1; }
    const deckId=await upsertDeck(client,user,profileId,subjectId,deck);
    seededDecks += 1;
    const topicMap=await ensureTopics(client,user,profileId,subjectId,deck); topics += topicMap.size;
    const result=await upsertCards(client,user,profileId,subjectId,deckId,deck,topicMap,seen,existingBuiltinByContent,existingBuiltinByLegacyId);
    cards += result.inserted;
    reconciled += result.reconciled;
    duplicatesSkipped += result.skipped;
  }
  const staleBuiltinIds = ((existing || []) as ExistingBuiltinCard[])
    .filter((row) => builtinDeckIds.has(row.deck_id))
    .filter((row) => Boolean(row.legacy_id?.startsWith('card-trt4-')))
    .filter((row) => !currentBuiltinLegacyIds.has(row.legacy_id!))
    .map((row) => row.id);
  for (let start=0; start<staleBuiltinIds.length; start+=100) {
    const { error } = await client.from('cards')
      .update({ deleted_at: new Date().toISOString(), suspended: true })
      .in('id', staleBuiltinIds.slice(start,start+100));
    if (error) throw error;
  }

  return { decks:seededDecks, cards: cards + reconciled, topics, duplicatesSkipped };
}
