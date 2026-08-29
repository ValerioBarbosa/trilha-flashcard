import type { SupabaseClient, User } from '@supabase/supabase-js';

type LegacyProfile = {
  id: string;
  name: string;
  builtin?: boolean;
  role?: string;
  board?: string;
  editalYear?: string;
};

type LegacyCard = {
  id?: string;
  front?: string;
  back?: string;
  topic?: string;
  subtopic?: string;
  discipline?: string;
  subject?: string;
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
  source?: string;
  sourcePage?: number | string;
};

type LegacyDeck = {
  id?: string;
  title?: string;
  name?: string;
  sourceNote?: string;
  source?: string;
  custom?: boolean;
  cards?: LegacyCard[];
};

export type LegacyMigrationReport = {
  profiles: number;
  subjects: number;
  topics: number;
  decks: number;
  cards: number;
  skippedCards: number;
};

const DEFAULT_PROFILE: LegacyProfile = {
  id: 'trt4',
  name: 'TRT-4 · AJAJ',
  builtin: true,
  role: 'Analista Judiciário · Área Judiciária',
  board: 'FCC',
  editalYear: '2026',
};

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

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

function profileSlug(profile: LegacyProfile): string {
  return profile.id === DEFAULT_PROFILE.id ? 'trt4-ajaj' : slugify(profile.id || profile.name);
}

function normalizedPriority(value?: string): 'A' | 'B' | 'C' | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'A' || normalized === 'B' || normalized === 'C' ? normalized : null;
}

function normalizedDifficulty(value?: string): 'easy' | 'medium' | 'hard' | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'facil' || normalized === 'fácil') return 'easy';
  if (normalized === 'medium' || normalized === 'medio' || normalized === 'médio') return 'medium';
  if (normalized === 'hard' || normalized === 'dificil' || normalized === 'difícil') return 'hard';
  return null;
}

function readProfiles(storage: Storage): LegacyProfile[] {
  const custom = parseJson<LegacyProfile[]>(storage.getItem('trilha-flashcard-profiles'), []);
  const seen = new Set<string>();
  return [DEFAULT_PROFILE, ...custom].filter((profile) => {
    if (!profile?.id || !profile?.name || seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

function readCustomDecks(storage: Storage, profileId: string): LegacyDeck[] {
  const key = profileId === 'trt4'
    ? 'trilha-flashcard-custom-decks'
    : `trilha-flashcard-custom-decks::${profileId}`;
  const decks = parseJson<LegacyDeck[]>(storage.getItem(key), []);
  return Array.isArray(decks) ? decks : [];
}

function readDeckOverrides(storage: Storage, profileId: string): LegacyDeck[] {
  const decks: LegacyDeck[] = [];
  const prefix = profileId === 'trt4'
    ? 'trilha-flashcard-deck:'
    : `trilha-flashcard-deck:${profileId}::`;

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(prefix)) continue;
    const cards = parseJson<LegacyCard[]>(storage.getItem(key), []);
    if (!Array.isArray(cards)) continue;
    const deckId = key.slice(prefix.length);
    decks.push({ id: deckId, title: deckId, custom: false, cards });
  }
  return decks;
}

async function upsertProfile(client: SupabaseClient, user: User, profile: LegacyProfile) {
  const slug = profileSlug(profile);
  const { data, error } = await client
    .from('study_profiles')
    .upsert({
      user_id: user.id,
      slug,
      name: profile.name,
      role: profile.role || null,
      board: profile.board || null,
      edital_year: profile.editalYear || null,
      is_builtin: Boolean(profile.builtin),
    }, { onConflict: 'user_id,slug' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertSubject(client: SupabaseClient, user: User, profileId: string, name: string) {
  const slug = slugify(name);
  const { data, error } = await client
    .from('subjects')
    .upsert({ user_id: user.id, profile_id: profileId, name, slug }, { onConflict: 'profile_id,slug' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertDeck(
  client: SupabaseClient,
  user: User,
  profileId: string,
  subjectId: string | null,
  deck: LegacyDeck,
) {
  const name = deck.title?.trim() || deck.name?.trim() || deck.id || 'Baralho importado';
  const slug = slugify(deck.id || name);
  const { data, error } = await client
    .from('decks')
    .upsert({
      user_id: user.id,
      profile_id: profileId,
      subject_id: subjectId,
      name,
      slug,
      source: deck.sourceNote || deck.source || null,
      is_builtin: !deck.custom,
    }, { onConflict: 'profile_id,slug' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertTopic(
  client: SupabaseClient,
  user: User,
  profileId: string,
  subjectId: string,
  name: string,
) {
  const slug = slugify(name);
  const { data: existing, error: readError } = await client
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId)
    .is('parent_id', null)
    .eq('slug', slug)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from('topics')
    .insert({ user_id: user.id, profile_id: profileId, subject_id: subjectId, name, slug })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

function legacyCardId(deckIdentity: string, card: LegacyCard): string {
  const explicit = card.id?.trim();
  if (explicit) return explicit;
  return `card-${stableHash(`${deckIdentity}|${card.front || ''}|${card.back || ''}`)}`;
}

function cardTags(card: LegacyCard): string[] {
  const tags = new Set<string>();
  if (Array.isArray(card.tags)) card.tags.filter(Boolean).forEach((tag) => tags.add(String(tag).trim()));
  if (card.tag?.trim()) tags.add(card.tag.trim());
  if (card.subtopic?.trim()) tags.add(card.subtopic.trim());
  return [...tags].filter(Boolean);
}

function sourcePage(value: LegacyCard['sourcePage']): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

export async function migrateLegacyLocalData(
  client: SupabaseClient,
  user: User,
  storage: Storage = window.localStorage,
): Promise<LegacyMigrationReport> {
  const report: LegacyMigrationReport = {
    profiles: 0,
    subjects: 0,
    topics: 0,
    decks: 0,
    cards: 0,
    skippedCards: 0,
  };

  const topicCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();

  for (const legacyProfile of readProfiles(storage)) {
    const profileId = await upsertProfile(client, user, legacyProfile);
    report.profiles += 1;

    const decks = [...readCustomDecks(storage, legacyProfile.id), ...readDeckOverrides(storage, legacyProfile.id)];
    const seenDecks = new Map<string, LegacyDeck>();
    for (const deck of decks) {
      const identity = deck.id || deck.title || deck.name || `deck-${seenDecks.size + 1}`;
      seenDecks.set(identity, deck);
    }

    for (const [deckIdentity, deck] of seenDecks) {
      const cards = Array.isArray(deck.cards) ? deck.cards : [];
      const inferredSubjectName = cards.find((card) => card.discipline?.trim() || card.subject?.trim());
      const subjectName = inferredSubjectName?.discipline?.trim()
        || inferredSubjectName?.subject?.trim()
        || deck.title?.trim()
        || deck.name?.trim()
        || deck.id
        || 'Geral';

      const subjectCacheKey = `${profileId}:${slugify(subjectName)}`;
      let subjectId = subjectCache.get(subjectCacheKey);
      if (!subjectId) {
        subjectId = await upsertSubject(client, user, profileId, subjectName);
        subjectCache.set(subjectCacheKey, subjectId);
        report.subjects += 1;
      }

      const deckId = await upsertDeck(client, user, profileId, subjectId, deck);
      report.decks += 1;

      for (const card of cards) {
        const front = card.front?.trim();
        const back = card.back?.trim();
        if (!front || !back) {
          report.skippedCards += 1;
          continue;
        }

        let topicId: string | null = null;
        if (card.topic?.trim()) {
          const topicName = card.topic.trim();
          const topicCacheKey = `${subjectId}:${slugify(topicName)}`;
          topicId = topicCache.get(topicCacheKey) || null;
          if (!topicId) {
            topicId = await upsertTopic(client, user, profileId, subjectId, topicName);
            topicCache.set(topicCacheKey, topicId);
            report.topics += 1;
          }
        }

        const legacyId = legacyCardId(deckIdentity, card);
        const { error } = await client
          .from('cards')
          .upsert({
            user_id: user.id,
            profile_id: profileId,
            deck_id: deckId,
            subject_id: subjectId,
            topic_id: topicId,
            legacy_id: legacyId,
            front,
            back,
            card_type: card.cardType || card.type || null,
            legal_basis: card.legalBasis || null,
            example: card.example || null,
            complement: card.complement || null,
            pitfall: card.pitfall || null,
            mnemonic: card.mnemonic || null,
            priority: normalizedPriority(card.priority),
            difficulty: normalizedDifficulty(card.difficulty),
            tags: cardTags(card),
            source: card.source || deck.sourceNote || deck.source || null,
            source_page: sourcePage(card.sourcePage),
            deleted_at: null,
          }, { onConflict: 'user_id,deck_id,legacy_id' });
        if (error) throw error;
        report.cards += 1;
      }
    }
  }

  return report;
}
