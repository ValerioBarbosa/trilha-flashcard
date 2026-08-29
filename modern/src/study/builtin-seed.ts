import type { SupabaseClient, User } from '@supabase/supabase-js';
import legacyDecks from '../generated/legacy-decks.json';

type LegacyCard = Record<string, unknown> & {
  id?: string; front?: string; back?: string; topic?: string; subtopic?: string;
  legalBasis?: string; cardType?: string; type?: string; priority?: string; difficulty?: string;
  tag?: string; tags?: string[]; example?: string; complement?: string; pitfall?: string; mnemonic?: string;
};
type LegacyDeck = { id: string; title: string; sourceNote?: string; topics?: string[]; cards?: LegacyCard[] };
export type BuiltinSeedReport = { decks: number; cards: number; topics: number; duplicatesSkipped: number };

function stableHash(value: string): string { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function slugify(value: string): string { const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100); return normalized || `item-${stableHash(value)}`; }
function subjectName(deck: LegacyDeck): string { const title = deck.title?.trim() || deck.id; return title.split('·')[0]?.trim() || title; }
function contentKey(front: string, back: string): string { return `${front.trim().toLowerCase()}|${back.trim().toLowerCase()}`; }
function normalizedPriority(value: unknown): 'A'|'B'|'C'|null { const v = typeof value === 'string' ? value.trim().toUpperCase() : ''; return v === 'A' || v === 'B' || v === 'C' ? v : null; }
function normalizedDifficulty(value: unknown): 'easy'|'medium'|'hard'|null { const v = typeof value === 'string' ? value.trim().toLowerCase() : ''; if (['easy','facil','fácil'].includes(v)) return 'easy'; if (['medium','medio','médio'].includes(v)) return 'medium'; if (['hard','dificil','difícil'].includes(v)) return 'hard'; return null; }
function tagsFor(card: LegacyCard): string[] { const values = new Set<string>(); if (Array.isArray(card.tags)) card.tags.forEach((tag) => tag && values.add(String(tag).trim())); if (card.tag?.trim()) values.add(card.tag.trim()); if (card.subtopic?.trim()) values.add(card.subtopic.trim()); return [...values].filter(Boolean); }

async function upsertSubject(client: SupabaseClient, user: User, profileId: string, name: string, order: number) {
  const { data, error } = await client.from('subjects').upsert({ user_id:user.id, profile_id:profileId, name, slug:slugify(name), sort_order:order }, { onConflict:'profile_id,slug' }).select('id').single();
  if (error) throw error; return data.id as string;
}
async function upsertDeck(client: SupabaseClient, user: User, profileId: string, subjectId: string, deck: LegacyDeck) {
  const { data, error } = await client.from('decks').upsert({ user_id:user.id, profile_id:profileId, subject_id:subjectId, name:deck.title || deck.id, slug:slugify(deck.id), source:deck.sourceNote || 'Catálogo nativo Trilha Flashcard', is_builtin:true, is_archived:false }, { onConflict:'profile_id,slug' }).select('id').single();
  if (error) throw error; return data.id as string;
}
async function ensureTopics(client: SupabaseClient, user: User, profileId: string, subjectId: string, deck: LegacyDeck): Promise<Map<string,string>> {
  const names = new Set<string>(); (deck.topics || []).forEach((name) => name?.trim() && names.add(name.trim())); (deck.cards || []).forEach((card) => card.topic?.trim() && names.add(card.topic.trim()));
  if (!names.size) return new Map();
  const rows = [...names].map((name,index) => ({ user_id:user.id, profile_id:profileId, subject_id:subjectId, parent_id:null, name, slug:slugify(name), sort_order:index }));
  const { data, error } = await client.from('topics').upsert(rows, { onConflict:'subject_id,parent_id,slug' }).select('id,name'); if (error) throw error;
  return new Map((data || []).map((row:any) => [row.name,row.id]));
}

async function upsertCards(client: SupabaseClient, user: User, profileId: string, subjectId: string, deckId: string, deck: LegacyDeck, topics: Map<string,string>, seen: Set<string>) {
  const rows:any[] = []; let skipped = 0;
  for (const card of deck.cards || []) {
    const front = card.front?.trim(); const back = card.back?.trim(); if (!front || !back) continue;
    const key = contentKey(front, back); if (seen.has(key)) { skipped += 1; continue; } seen.add(key);
    rows.push({ user_id:user.id, profile_id:profileId, deck_id:deckId, subject_id:subjectId, topic_id:card.topic ? topics.get(card.topic.trim()) || null : null, legacy_id:card.id?.trim() || `card-${stableHash(`${deck.id}|${front}|${back}`)}`, front, back, card_type:typeof card.cardType === 'string' ? card.cardType : typeof card.type === 'string' ? card.type : null, legal_basis:typeof card.legalBasis === 'string' ? card.legalBasis : null, example:typeof card.example === 'string' ? card.example : null, complement:typeof card.complement === 'string' ? card.complement : null, pitfall:typeof card.pitfall === 'string' ? card.pitfall : null, mnemonic:typeof card.mnemonic === 'string' ? card.mnemonic : null, priority:normalizedPriority(card.priority), difficulty:normalizedDifficulty(card.difficulty), tags:tagsFor(card), source:deck.sourceNote || 'Catálogo nativo Trilha Flashcard', deleted_at:null, suspended:false });
  }
  for (let start=0; start<rows.length; start+=100) { const { error } = await client.from('cards').upsert(rows.slice(start,start+100), { onConflict:'user_id,deck_id,legacy_id' }); if (error) throw error; }
  return { inserted: rows.length, skipped };
}

export async function seedBuiltinStudyCatalog(client: SupabaseClient, user: User, profileId: string): Promise<BuiltinSeedReport> {
  const decks = legacyDecks as LegacyDeck[];
  const { data: existing, error: existingError } = await client.from('cards').select('front,back').eq('profile_id', profileId).is('deleted_at', null); if (existingError) throw existingError;
  const seen = new Set<string>((existing || []).map((row:any) => contentKey(row.front,row.back)));
  let cards=0, topics=0, duplicatesSkipped=0;
  for (let index=0; index<decks.length; index+=1) {
    const deck=decks[index]; const subjectId=await upsertSubject(client,user,profileId,subjectName(deck),index); const deckId=await upsertDeck(client,user,profileId,subjectId,deck); const topicMap=await ensureTopics(client,user,profileId,subjectId,deck); topics += topicMap.size;
    const result=await upsertCards(client,user,profileId,subjectId,deckId,deck,topicMap,seen); cards += result.inserted; duplicatesSkipped += result.skipped;
  }
  return { decks:decks.length, cards, topics, duplicatesSkipped };
}
