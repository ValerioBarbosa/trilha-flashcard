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
};

async function loadCompleteCatalogDecks(): Promise<LegacyDeck[]> {
  const chunks = await Promise.all(COMPLETE_CATALOG_PARTS.map(async (path) => {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) throw new Error(`builtin-catalog-fetch-failed:${path}:${response.status}`);
    return response.text();
  }));
  const parsed = JSON.parse(chunks.join('\n')) as CompleteCatalogFile;
  const groups = new Map<string, LegacyDeck>();

  for (const card of parsed.cards || []) {
    const deckId = card.discipline;
    if (!deckId) continue;
    let deck = groups.get(deckId);
    if (!deck) {
      deck = {
        id: deckId,
        title: COMPLETE_DECK_TITLES[deckId] || card.disciplineName || deckId,
        sourceNote: 'Edital Verticalizado TRT-4 AJAJ 2026 V3 · catálogo completo 1.077 cartões',
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
  const names = new Set<string>(); (deck.topics || []).forEach((name) => name?.trim() && names.add(name.trim())); (deck.cards || []).forEach((card) => card.topic?.trim() && names.add(card.topic.trim()));
  if (!names.size) return new Map();
  const rows = [...names].map((name,index) => ({ user_id:user.id, profile_id:profileId, subject_id:subjectId, parent_id:null, name, slug:slugify(name), sort_order:index }));
  const { data, error } = await client.from('topics').upsert(rows, { onConflict:'subject_id,parent_id,slug' }).select('id,name'); if (error) throw error;
  return new Map((data || []).map((row:any) => [row.name,row.id]));
}

async function upsertCards(client: SupabaseClient, user: User, profileId: string, subjectId: string | null, deckId: string, deck: LegacyDeck, topics: Map<string,string>, seen: Set<string>) {
  const rows:any[] = []; let skipped = 0;
  for (const card of deck.cards || []) {
    const front = card.front?.trim(); const back = card.back?.trim(); if (!front || !back) continue;
    const key = contentKey(subjectId, front, back); if (seen.has(key)) { skipped += 1; continue; } seen.add(key);
    rows.push({ user_id:user.id, profile_id:profileId, deck_id:deckId, subject_id:subjectId, topic_id:subjectId && card.topic ? topics.get(card.topic.trim()) || null : null, legacy_id:card.id?.trim() || `card-${stableHash(`${deck.id}|${front}|${back}`)}`, front, back, card_type:typeof card.cardType === 'string' ? card.cardType : typeof card.type === 'string' ? card.type : null, legal_basis:typeof card.legalBasis === 'string' ? card.legalBasis : null, example:typeof card.example === 'string' ? card.example : null, complement:typeof card.complement === 'string' ? card.complement : null, pitfall:typeof card.pitfall === 'string' ? card.pitfall : null, mnemonic:typeof card.mnemonic === 'string' ? card.mnemonic : null, priority:normalizedPriority(card.priority), difficulty:normalizedDifficulty(card.difficulty), tags:tagsFor(card), source:deck.sourceNote || 'Catálogo nativo Trilha Flashcard', deleted_at:null, suspended:false });
  }
  for (let start=0; start<rows.length; start+=100) { const { error } = await client.from('cards').upsert(rows.slice(start,start+100), { onConflict:'user_id,deck_id,legacy_id' }); if (error) throw error; }
  return { inserted: rows.length, skipped };
}

export async function seedBuiltinStudyCatalog(client: SupabaseClient, user: User, profileId: string): Promise<BuiltinSeedReport> {
  const completeDecks = await loadCompleteCatalogDecks();
  const decks = mergeLegacyDecks(legacyDecks as LegacyDeck[], completeDecks);
  const { data: existing, error: existingError } = await client.from('cards').select('subject_id,front,back').eq('profile_id', profileId).is('deleted_at', null); if (existingError) throw existingError;
  const seen = new Set<string>((existing || []).map((row:any) => contentKey(row.subject_id, row.front, row.back)));
  let seededDecks=0, cards=0, topics=0, duplicatesSkipped=0, order=0;
  for (const deck of decks) {
    if (!isOnboardingDeck(deck) && isEmptyDeck(deck)) continue;
    let subjectId: string | null = null;
    if (!isOnboardingDeck(deck)) { subjectId = await upsertSubject(client,user,profileId,subjectName(deck),order,subjectWeight(deck)); order += 1; }
    const deckId=await upsertDeck(client,user,profileId,subjectId,deck);
    seededDecks += 1;
    const topicMap=await ensureTopics(client,user,profileId,subjectId,deck); topics += topicMap.size;
    const result=await upsertCards(client,user,profileId,subjectId,deckId,deck,topicMap,seen); cards += result.inserted; duplicatesSkipped += result.skipped;
  }
  return { decks:seededDecks, cards, topics, duplicatesSkipped };
}
