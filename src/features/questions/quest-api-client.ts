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
  alternative_type?: 'MULTIPLA_ESCOLHA' | 'CERTO_ERRADO';
  tem_gabarito?: boolean;
  tem_anexos?: boolean;
  include_gabarito?: boolean;
};

export type QuestApiQuestionItem = {
  id: string;
  numero?: string | null;
  enunciado: string;
  alternativas?: Array<{ letra?: string; texto?: string; imagens?: unknown[] }>;
  gabarito?: string | null;
  prova?: {
    id?: string;
    orgao?: string | null;
    cargo?: string | null;
    ano?: string | number | null;
    banca?: string | null;
    alternative_type?: string | null;
  } | null;
  classificacao?: { materia?: string | null } | null;
  textos_associados?: string[];
};

export type QuestApiQuestionPage = {
  total: number;
  page: number;
  per_page: number;
  next_cursor?: string | null;
  items: QuestApiQuestionItem[];
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
  const { data, error } = await client.functions.invoke<QuestApiEnvelope<QuestApiQuestionPage>>('quest-api', {
    body: {
      resource: 'questions',
      params: filters,
    },
  });

  if (error) throw error;
  return data;
}
