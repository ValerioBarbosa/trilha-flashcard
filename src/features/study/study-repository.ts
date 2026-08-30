import type { SupabaseClient, User } from '@supabase/supabase-js';

export type StudyProfile = {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  board: string | null;
  edital_year: string | null;
};

export type StudyMetrics = {
  profiles: number;
  subjects: number;
  topics: number;
  decks: number;
  cards: number;
  reviews: number;
  questions: number;
  attempts: number;
  jurisprudence: number;
  openErrors: number;
};

const DEFAULT_PROFILE = {
  slug: 'trt4-ajaj',
  name: 'TRT-4 · AJAJ',
  role: 'Analista Judiciário · Área Judiciária',
  board: 'FCC',
  edital_year: '2026',
  is_builtin: true,
};

async function exactCount(client: SupabaseClient, table: string, filters?: (query: any) => any) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filters) query = filters(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function ensureDefaultProfile(client: SupabaseClient, user: User): Promise<StudyProfile> {
  const { data: existing, error: readError } = await client
    .from('study_profiles')
    .select('id,slug,name,role,board,edital_year')
    .eq('user_id', user.id)
    .eq('slug', DEFAULT_PROFILE.slug)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing as StudyProfile;

  const { data, error } = await client
    .from('study_profiles')
    .insert({ ...DEFAULT_PROFILE, user_id: user.id })
    .select('id,slug,name,role,board,edital_year')
    .single();

  if (error) throw error;
  return data as StudyProfile;
}

export async function loadStudyMetrics(client: SupabaseClient, user: User): Promise<StudyMetrics> {
  const own = (query: any) => query.eq('user_id', user.id);
  const openErrors = (query: any) => query.eq('user_id', user.id).eq('resolved', false);

  const [profiles, subjects, topics, decks, cards, reviews, questions, attempts, jurisprudence, errors] = await Promise.all([
    exactCount(client, 'study_profiles', own),
    exactCount(client, 'subjects', own),
    exactCount(client, 'topics', own),
    exactCount(client, 'decks', own),
    exactCount(client, 'cards', (query) => own(query).is('deleted_at', null)),
    exactCount(client, 'reviews', own),
    exactCount(client, 'questions', own),
    exactCount(client, 'question_attempts', own),
    exactCount(client, 'jurisprudence', own),
    exactCount(client, 'error_notebook', openErrors),
  ]);

  return {
    profiles,
    subjects,
    topics,
    decks,
    cards,
    reviews,
    questions,
    attempts,
    jurisprudence,
    openErrors: errors,
  };
}
