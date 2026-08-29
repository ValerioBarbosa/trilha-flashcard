import type { SupabaseClient, User } from '@supabase/supabase-js';

export type QuestionAttemptSummary = {
  total: number;
  correct: number;
  accuracy: number;
};

export async function recordQuestionAttempt(
  client: SupabaseClient,
  user: User,
  profileId: string,
  input: {
    questionId: string;
    answer: string;
    correctAnswer?: string | null;
    responseMs?: number | null;
  },
): Promise<boolean | null> {
  const expected = input.correctAnswer?.trim().toUpperCase() || null;
  const answer = input.answer.trim().toUpperCase();
  const isCorrect = expected ? answer === expected : null;
  const { error } = await client.from('question_attempts').insert({
    user_id: user.id,
    profile_id: profileId,
    question_id: input.questionId,
    answer,
    is_correct: isCorrect,
    response_ms: input.responseMs ?? null,
  });
  if (error) throw error;
  return isCorrect;
}

export async function getQuestionAttemptSummary(
  client: SupabaseClient,
  profileId: string,
): Promise<QuestionAttemptSummary> {
  const { data, error } = await client.from('question_attempts')
    .select('is_correct')
    .eq('profile_id', profileId);
  if (error) throw error;
  const rows = data || [];
  const graded = rows.filter((row: { is_correct: boolean | null }) => row.is_correct !== null);
  const correct = graded.filter((row: { is_correct: boolean | null }) => row.is_correct === true).length;
  return {
    total: rows.length,
    correct,
    accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0,
  };
}

export async function addQuestionToErrorNotebook(
  client: SupabaseClient,
  user: User,
  profileId: string,
  input: {
    questionId: string;
    subjectId?: string | null;
    topicId?: string | null;
    title: string;
    correction?: string | null;
    legalBasis?: string | null;
  },
): Promise<void> {
  const { data: existing, error: lookupError } = await client.from('error_notebook')
    .select('id')
    .eq('profile_id', profileId)
    .eq('question_id', input.questionId)
    .eq('kind', 'question')
    .eq('resolved', false)
    .limit(1);
  if (lookupError) throw lookupError;
  if (existing?.length) return;

  const { error } = await client.from('error_notebook').insert({
    user_id: user.id,
    profile_id: profileId,
    subject_id: input.subjectId || null,
    topic_id: input.topicId || null,
    question_id: input.questionId,
    kind: 'question',
    title: input.title.trim(),
    correction: input.correction?.trim() || null,
    legal_basis: input.legalBasis?.trim() || null,
    resolved: false,
  });
  if (error) throw error;
}
