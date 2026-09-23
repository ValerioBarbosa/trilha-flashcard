import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ProfileRow = {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  board: string | null;
  edital_year: string | null;
  is_builtin: boolean;
};

export type SubjectRow = {
  id: string;
  name: string;
  slug: string;
  weight: number | null;
  priority: string | null;
  sort_order: number;
};

export type TopicRow = {
  id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  edital_text: string | null;
  legal_basis: string | null;
  priority: string | null;
  sort_order: number;
};

export type DeckRow = {
  id: string;
  profile_id: string;
  subject_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  source: string | null;
  is_builtin: boolean;
  is_archived: boolean;
};

export type CardRow = {
  id: string;
  deck_id: string;
  subject_id: string | null;
  topic_id: string | null;
  front: string;
  back: string;
  card_type: string | null;
  legal_basis: string | null;
  example: string | null;
  complement: string | null;
  pitfall: string | null;
  mnemonic: string | null;
  priority: string | null;
  difficulty: string | null;
  tags: string[];
  read_at: string | null;
};

export type JurisprudenceRow = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  court: string;
  body: string | null;
  theme: string | null;
  process_number: string | null;
  thesis: string;
  summary: string | null;
  legal_basis: string | null;
  exam_angle: string | null;
  pitfall: string | null;
  judgment_date: string | null;
  bulletin: string | null;
  status: string;
};

async function requireData<T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

const PAGE_SIZE = 1000;

async function requirePaged<T>(queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function listProfiles(client: SupabaseClient, user: User): Promise<ProfileRow[]> {
  return requireData(client.from('study_profiles')
    .select('id,name,slug,role,board,edital_year,is_builtin')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at'));
}

export async function listSubjects(client: SupabaseClient, profileId: string): Promise<SubjectRow[]> {
  return requireData(client.from('subjects')
    .select('id,name,slug,weight,priority,sort_order')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name'));
}

export async function listTopics(client: SupabaseClient, profileId: string): Promise<TopicRow[]> {
  return requireData(client.from('topics')
    .select('id,subject_id,parent_id,name,slug,edital_text,legal_basis,priority,sort_order')
    .eq('profile_id', profileId)
    .order('sort_order')
    .order('name'));
}

export async function listDecks(client: SupabaseClient, profileId: string): Promise<DeckRow[]> {
  return requireData(client.from('decks')
    .select('id,profile_id,subject_id,name,slug,description,source,is_builtin,is_archived')
    .eq('profile_id', profileId)
    .eq('is_archived', false)
    .order('name'));
}

export async function listCards(client: SupabaseClient, deckId: string): Promise<CardRow[]> {
  return requirePaged<CardRow>((from, to) => client.from('cards')
    .select('id,deck_id,subject_id,topic_id,front,back,card_type,legal_basis,example,complement,pitfall,mnemonic,priority,difficulty,tags,read_at')
    .eq('deck_id', deckId)
    .is('deleted_at', null)
    .eq('suspended', false)
    .or('card_type.is.null,card_type.neq.Lei seca')
    .order('created_at')
    .range(from, to));
}

export async function listCardsByType(client: SupabaseClient, profileId: string, cardType: string): Promise<CardRow[]> {
  return requirePaged<CardRow>((from, to) => client.from('cards')
    .select('id,deck_id,subject_id,topic_id,front,back,card_type,legal_basis,example,complement,pitfall,mnemonic,priority,difficulty,tags,read_at')
    .eq('profile_id', profileId)
    .eq('card_type', cardType)
    .is('deleted_at', null)
    .eq('suspended', false)
    .order('created_at')
    .range(from, to));
}

export async function setCardReadAt(client: SupabaseClient, cardId: string, read: boolean): Promise<void> {
  const { error } = await client.from('cards').update({ read_at: read ? new Date().toISOString() : null }).eq('id', cardId);
  if (error) throw error;
}


export async function listOfficialEditalTopicIds(client: SupabaseClient, profileId: string): Promise<Set<string>> {
  const data = await requirePaged<{ topic_id: string | null; card_type: string | null }>((from, to) => client.from('cards')
    .select('topic_id,card_type')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .eq('suspended', false)
    .like('source', 'Edital Verticalizado TRT-4 AJAJ 2026 V3%')
    .not('topic_id', 'is', null)
    .order('id')
    .range(from, to));
  const topicIds = new Set<string>();
  for (const row of data) {
    if (!row.topic_id || row.card_type === 'Lei seca') continue;
    topicIds.add(row.topic_id);
  }
  return topicIds;
}

export type EditalTopicProgress = {
  cardCount: number;
  leiSecaCount: number;
  reviewedCount: number;
  masteredCount: number;
  status: 'Não iniciado' | 'Em estudo' | 'Revisado' | 'Dominado';
};

export async function listEditalTopicProgress(client: SupabaseClient, profileId: string): Promise<Map<string, EditalTopicProgress>> {
  const [cards, reviews] = await Promise.all([
    requirePaged<{ id: string; topic_id: string | null; card_type: string | null }>((from, to) => client.from('cards')
      .select('id,topic_id,card_type')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .eq('suspended', false)
      .not('topic_id', 'is', null)
      .order('id')
      .range(from, to)),
    requirePaged<{ card_id: string; rating: number }>((from, to) => client.from('reviews')
      .select('card_id,rating')
      .eq('profile_id', profileId)
      .order('reviewed_at', { ascending: false })
      .range(from, to)),
  ]);

  const latestRating = new Map<string, number>();
  for (const review of reviews) if (!latestRating.has(review.card_id)) latestRating.set(review.card_id, review.rating);

  const grouped = new Map<string, { studyCards: string[]; leiSecaCount: number }>();
  for (const card of cards) {
    if (!card.topic_id) continue;
    const bucket = grouped.get(card.topic_id) ?? { studyCards: [], leiSecaCount: 0 };
    if (card.card_type === 'Lei seca') bucket.leiSecaCount += 1;
    else bucket.studyCards.push(card.id);
    grouped.set(card.topic_id, bucket);
  }

  const result = new Map<string, EditalTopicProgress>();
  for (const [topicId, group] of grouped) {
    const ratings = group.studyCards.map((id) => latestRating.get(id)).filter((value): value is number => typeof value === 'number');
    const reviewedCount = ratings.length;
    const masteredCount = ratings.filter((rating) => rating >= 3).length;
    const studyCardCount = group.studyCards.length;
    let status: EditalTopicProgress['status'] = 'Não iniciado';
    if (reviewedCount > 0 && reviewedCount < studyCardCount) status = 'Em estudo';
    else if (studyCardCount > 0 && reviewedCount >= studyCardCount && masteredCount < studyCardCount) status = 'Revisado';
    else if (studyCardCount > 0 && masteredCount >= studyCardCount) status = 'Dominado';
    result.set(topicId, { cardCount: studyCardCount, leiSecaCount: group.leiSecaCount, reviewedCount, masteredCount, status });
  }
  return result;
}

export async function listStudyCardCountsByTopic(client: SupabaseClient, profileId: string): Promise<Map<string, number>> {
  const data = await requirePaged<{ topic_id: string | null }>((from, to) => client.from('cards')
    .select('topic_id')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .eq('suspended', false)
    .or('card_type.is.null,card_type.neq.Lei seca')
    .not('topic_id', 'is', null)
    .range(from, to));
  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.topic_id) continue;
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }
  return counts;
}

export async function saveReview(
  client: SupabaseClient,
  user: User,
  profileId: string,
  cardId: string,
  rating: 1 | 2 | 3 | 4,
  responseMs?: number,
): Promise<void> {
  const intervalByRating = { 1: 0, 2: 1, 3: 7, 4: 30 } as const;
  const intervalDays = intervalByRating[rating];
  const dueAt = new Date(Date.now() + intervalDays * 86_400_000).toISOString();
  const { error } = await client.from('reviews').insert({
    user_id: user.id,
    profile_id: profileId,
    card_id: cardId,
    rating,
    response_ms: responseMs ?? null,
    interval_days: intervalDays,
    due_at: dueAt,
    algorithm: 'legacy-compatible',
  });
  if (error) throw error;
}

export async function listJurisprudence(client: SupabaseClient, profileId: string): Promise<JurisprudenceRow[]> {
  return requireData(client.from('jurisprudence')
    .select('id,subject_id,topic_id,court,body,theme,process_number,thesis,summary,legal_basis,exam_angle,pitfall,judgment_date,bulletin,status')
    .eq('profile_id', profileId)
    .order('judgment_date', { ascending: false, nullsFirst: false })
    .limit(100));
}

export type LatestReview = { rating: number; due_at: string };

export async function listLatestReviewsByCard(client: SupabaseClient, profileId: string): Promise<Map<string, LatestReview>> {
  const rows = await requirePaged<{ card_id: string; rating: number; due_at: string }>((from, to) => client.from('reviews')
    .select('card_id,rating,due_at')
    .eq('profile_id', profileId)
    .order('reviewed_at', { ascending: false })
    .range(from, to));
  const latest = new Map<string, LatestReview>();
  for (const row of rows) {
    if (!latest.has(row.card_id)) latest.set(row.card_id, { rating: row.rating, due_at: row.due_at });
  }
  return latest;
}

export async function listOpenErrorCardIds(client: SupabaseClient, profileId: string): Promise<Set<string>> {
  const rows = await requirePaged<{ card_id: string | null }>((from, to) => client.from('error_notebook')
    .select('card_id')
    .eq('profile_id', profileId)
    .eq('kind', 'card')
    .eq('resolved', false)
    .order('id')
    .range(from, to));
  return new Set(rows.map((row) => row.card_id).filter((id): id is string => Boolean(id)));
}
