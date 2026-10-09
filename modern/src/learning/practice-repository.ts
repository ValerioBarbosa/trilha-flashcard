import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { PracticeQuestion } from './practice-bank';

const PROVIDER = 'trilha-autoral-20261009';
const LETTERS = 'ABCDE';

async function questionIdentity(userId: string, profileId: string, questionId: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${PROVIDER}|${userId}|${profileId}|${questionId}`));
  const hex = Array.from(new Uint8Array(bytes).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}

export async function savePracticeAttempt(client: SupabaseClient, user: User, profileId: string, question: PracticeQuestion, input: { answer: number; responseMs: number; attemptId: string; subjectId?: string }) {
  if (!Number.isInteger(input.answer) || input.answer < 0 || input.answer >= question.options.length) throw new Error('Alternativa inválida.');
  const id = await questionIdentity(user.id, profileId, question.id);
  const { data: existing, error: readError } = await client.from('questions').select('id').eq('user_id', user.id).eq('profile_id', profileId).eq('source_provider', PROVIDER).eq('external_id', question.id).is('deleted_at', null).maybeSingle();
  if (readError) throw readError;
  let questionId = existing?.id as string | undefined;
  if (!questionId) {
    const { error } = await client.from('questions').insert({
      id, user_id:user.id, profile_id:profileId, subject_id:input.subjectId || null,
      statement:question.statement, alternatives:question.options.map((text, index) => ({ key:LETTERS[index], text })),
      correct_answer:LETTERS[question.answer], explanation:question.explanation,
      legal_basis:question.basis, source_url:question.source || null,
      source:'Trilha — questão autoral, não é prova FCC', source_provider:PROVIDER, external_id:question.id,
      tags:['autoral', question.discipline],
    });
    if (error && error.code !== '23505') throw error;
    if (error) {
      // Another tab may have inserted it, or an imported copy may already exist.
      // Reuse the row without overwriting it or changing its ownership.
      const { data: duplicate, error: duplicateError } = await client.from('questions').select('id').eq('user_id', user.id).eq('profile_id', profileId).eq('statement', question.statement).is('deleted_at', null).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (!duplicate) throw error;
      questionId = duplicate.id;
    } else questionId = id;
  }
  // Idempotent retry: preserve this attempt's ID until the write is acknowledged.
  const { error } = await client.from('question_attempts').upsert({ id:input.attemptId, user_id:user.id, profile_id:profileId, question_id:questionId, answer:LETTERS[input.answer], is_correct:input.answer === question.answer, response_ms:Math.max(0, Math.min(2147483647, Math.round(input.responseMs))) }, { onConflict:'id', ignoreDuplicates:true });
  if (error) throw error;
}

export async function loadQuestionAccuracy(client: SupabaseClient, user: User, profileId: string) {
  let total = 0; let correct = 0;
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from('question_attempts').select('is_correct').eq('user_id', user.id).eq('profile_id', profileId).not('is_correct','is',null).order('id').range(start,start+999);
    if (error) throw error;
    const rows = data || []; total += rows.length; correct += rows.filter((row) => row.is_correct === true).length;
    if (rows.length < 1000) break;
  }
  return { total, correct, accuracy:total ? Math.round(correct / total * 100) : null };
}
