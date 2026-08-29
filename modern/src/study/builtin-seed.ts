import type { SupabaseClient, User } from '@supabase/supabase-js';
import legacyDecks from '../generated/legacy-decks.json';

type LegacyCard = Record<string, unknown> & {
  id?: string;
  front?: string;
  back?: string;
  topic?: string;
  subtopic?: string;
  legalBasis?: string;
  cardType?: string;
  type?: string;
  priority?: string;
  difficulty?: string;
  tag?: string;
  tags?: string[];
  example?: string;
  complement?: string;
  pitfall?: string;
  mnemonic?: string;
};

type LegacyDeck = {
  id: string;
  title: string;
  sourceNote?: string;
  topics?: string[];
  cards?: LegacyCard[];
};

export type BuiltinSeedReport = {
  decks: number;
  cards: number;
  topics: number;
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return normalized || `item-${stableHash(value)}`;
}

function subjectName(deck: LegacyDeck): string {
  const title = deck.title?.trim() || deck.id;
  const beforeWeight = title.split('·')[0]?.trim();
  return beforeWeight || title;
}

function normalizedPriority(value: unknown): 'A' | 'B' | 'C' | null {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'A' || normalized === 'B' || normalized === 'C' ? normalized : null;
}

function normalizedDifficulty(value: unknown): 'easy' | 'medium' | 'hard' | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (['easy', 'facil', 'fácil'].includes(normalized)) return 'easy';
  if (['medium', 'medio', 'médio'].includes(normalized)) return 'medium';
  if (['hard', 'dificil', 'difícil'].includes(normalized)) return 'hard';
  return null;
}

function tagsFor(card: LegacyCard): string[] {
  const values = new Set<string>();
  if (Array.isArray(card.tags)) card.tags.forEach((tag) => tag && values.add(String(tag).trim()));
  if (typeof card.tag === 'string' && card.tag.trim()) values.add(card.tag.trim());
  if (typeof card.subtopic === 'string' && card.subtopic.trim()) values.add(card.subtopic.trim());
  return [...values].filter(Boolean);
}

async function upsertSubject(client: SupabaseClient, user: User, profileId: string, name: string, order: number) {
  const slug = slugify(name);
  const { data, error } = await client.from('subjects').upsert({
    user_id: user.id,
    profile_id: profileId,
    name,
    slug,
    sort_order: order,
  }, { onConflict: 'profile_id,slug' }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function upsertDeck(client: SupabaseClient, user: User, profileId: string, subjectId: string, deck: LegacyDeck) {
  const { data, error } = await client.from('decks').upsert({
    user_id: user.id,
    profile_id: profileId,
    subject_id: subjectId,
    name: deck.title || deck.id,
    slug: slugify(deck.id),
    source: deck.sourceNote || 'Catálogo nativo Trilha Flashcard',
    is_builtin: true,
    is_archived: false,
  }, { onConflict: 'profile_id,slug' }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function ensureTopics(
  client: SupabaseClient,
  user: User,
  profileId: string,
  subjectId: string,
  deck: LegacyDeck,
): Promise<Map<string, string>> {
  const topicNames = new Set<string>();
  (deck.topics || []).forEach((name) => name?.trim() && topicNames.add(name.trim()));
  (deck.cards || []).forEach((card) => card.topic?.trim() && topicNames.add(card.topic.trim()));
  if (!topicNames.size) return new Map();

  const rows = [...topicNames].map((name, index) => ({
    user_id: user.id,
    profile_id: profileId,
    subject_id: subjectId,
    parent_id: null,
    name,
    slug: slugify(name),
    sort_order: index,
  }));

  const { data, error } = await client.from('topics')
    .upsert(rows, { onConflict: 'subject_id,parent_id,slug' })
    .select('id,name');
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.name, row.id]));
}

async function upsertCards(
  client: SupabaseClient,
  user: User,
  profileId: string,
  subjectId: string,
  deckId: string,
  deck: LegacyDeck,
  topics: Map<string, string>,
): Promise<number> {
  const cards = (deck.cards || []).filter((card) => card.front?.trim() && card.back?.trim());
  if (!cards.length) return 0;

  const rows = cards.map((card) => {
    const front = card.front!.trim();
    const back = card.back!.trim();
    const legacyId = card.id?.trim() || `card-${stableHash(`${deck.id}|${front}|${back}`)}`;
    return {
      user_id: user.id,
      profile_id: profileId,
      deck_id: deckId,
      subject_id: subjectId,
      topic_id: card.topic ? topics.get(card.topic.trim()) || null : null,
      legacy_id: legacyId,
      front,
      back,
      card_type: typeof card.cardType === 'string' ? card.cardType : typeof card.type === 'string' ? card.type : null,
      legal_basis: typeof card.legalBasis === 'string' ? card.legalBasis : null,
      example: typeof card.example === 'string' ? card.example : null,
      complement: typeof card.complement === 'string' ? card.complement : null,
      pitfall: typeof card.pitfall === 'string' ? card.pitfall : null,
      mnemonic: typeof card.mnemonic === 'string' ? card.mnemonic : null,
      priority: normalizedPriority(card.priority),
      difficulty: normalizedDifficulty(card.difficulty),
      tags: tagsFor(card),
      source: deck.sourceNote || 'Catálogo nativo Trilha Flashcard',
      deleted_at: null,
      suspended: false,
    };
  });

  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    const { error } = await client.from('cards').upsert(batch, { onConflict: 'user_id,deck_id,legacy_id' });
    if (error) throw error;
  }
  return rows.length;
}

export async function seedBuiltinStudyCatalog(
  client: SupabaseClient,
  user: User,
  profileId: string,
): Promise<BuiltinSeedReport> {
  const decks = legacyDecks as LegacyDeck[];
  let cardCount = 0;
  let topicCount = 0;

  for (let index = 0; index < decks.length; index += 1) {
    const deck = decks[index];
    const subjectId = await upsertSubject(client, user, profileId, subjectName(deck), index);
    const deckId = await upsertDeck(client, user, profileId, subjectId, deck);
    const topics = await ensureTopics(client, user, profileId, subjectId, deck);
    topicCount += topics.size;
    cardCount += await upsertCards(client, user, profileId, subjectId, deckId, deck, topics);
  }

  return { decks: decks.length, cards: cardCount, topics: topicCount };
}
