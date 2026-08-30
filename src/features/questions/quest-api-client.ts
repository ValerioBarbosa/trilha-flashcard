import { getSupabaseClient } from '../../infrastructure/supabase/client';

export type QuestApiQuestionFilters = {
  page?: number;
  per_page?: number;
  after_id?: string;
  banca?: string;
  orgao?: string;
  cargo?: string;
  materia?: string;
  ano?: number;
  codigo?: string;
  tipo?: string;
};

export type QuestApiEnvelope<T = unknown> = {
  data?: T;
  meta?: {
    correlationId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function listQuestApiQuestions(filters: QuestApiQuestionFilters = {}) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<QuestApiEnvelope>('quest-api', {
    body: {
      resource: 'questions',
      params: filters,
    },
  });

  if (error) throw error;
  return data;
}
