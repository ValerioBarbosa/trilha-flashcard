import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ManagedQuestion = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  board: string | null;
  exam: string | null;
  exam_year: number | null;
  statement: string;
  alternatives: unknown;
  correct_answer: string | null;
  explanation: string | null;
  legal_basis: string | null;
  source_url: string | null;
  source: string | null;
  tags: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionDraft = {
  subjectId?: string;
  topicId?: string;
  board?: string;
  exam?: string;
  examYear?: number | null;
  statement: string;
  alternatives?: Array<{ key: string; text: string }>;
  correctAnswer?: string;
  explanation?: string;
  legalBasis?: string;
  sourceUrl?: string;
  source?: string;
  tags?: string[];
};

export type QuestionImportCandidate = QuestionDraft & { row: number; duplicate?: boolean; duplicateReason?: string };

export async function listManagedQuestions(client: SupabaseClient, profileId: string): Promise<ManagedQuestion[]> {
  const { data, error } = await client.from('questions')
    .select('id,subject_id,topic_id,board,exam,exam_year,statement,alternatives,correct_answer,explanation,legal_basis,source_url,source,tags,deleted_at,created_at,updated_at')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ManagedQuestion[];
}

export async function createQuestion(client: SupabaseClient, user: User, profileId: string, draft: QuestionDraft): Promise<void> {
  const { error } = await client.from('questions').insert({
    user_id: user.id,
    profile_id: profileId,
    subject_id: draft.subjectId || null,
    topic_id: draft.topicId || null,
    board: draft.board?.trim() || null,
    exam: draft.exam?.trim() || null,
    exam_year: draft.examYear || null,
    statement: draft.statement.trim(),
    alternatives: draft.alternatives || [],
    correct_answer: draft.correctAnswer?.trim() || null,
    explanation: draft.explanation?.trim() || null,
    legal_basis: draft.legalBasis?.trim() || null,
    source_url: draft.sourceUrl?.trim() || null,
    source: draft.source?.trim() || null,
    tags: draft.tags || [],
    deleted_at: null,
  });
  if (error) throw normalizeQuestionError(error);
}

export async function updateQuestion(client: SupabaseClient, id: string, draft: QuestionDraft): Promise<void> {
  const { error } = await client.from('questions').update({
    subject_id: draft.subjectId || null,
    topic_id: draft.topicId || null,
    board: draft.board?.trim() || null,
    exam: draft.exam?.trim() || null,
    exam_year: draft.examYear || null,
    statement: draft.statement.trim(),
    alternatives: draft.alternatives || [],
    correct_answer: draft.correctAnswer?.trim() || null,
    explanation: draft.explanation?.trim() || null,
    legal_basis: draft.legalBasis?.trim() || null,
    source_url: draft.sourceUrl?.trim() || null,
    source: draft.source?.trim() || null,
    tags: draft.tags || [],
  }).eq('id', id);
  if (error) throw normalizeQuestionError(error);
}

export async function softDeleteQuestion(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('questions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function restoreQuestion(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('questions').update({ deleted_at: null }).eq('id', id);
  if (error) throw normalizeQuestionError(error);
}

export function parseQuestionJson(text: string, defaults: { subjectId?: string; board?: string }): QuestionImportCandidate[] {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  return rows.map((row: any, index: number) => {
    const alternatives = normalizeAlternatives(row.alternatives || row.alternativas || row.options || row.opcoes || []);
    return {
      row: index + 1,
      subjectId: row.subjectId || row.disciplineId || defaults.subjectId || '',
      topicId: row.topicId || null,
      board: String(row.board || row.banca || defaults.board || '').trim(),
      exam: String(row.exam || row.prova || row.concurso || '').trim(),
      examYear: Number.isFinite(Number(row.examYear || row.ano)) ? Number(row.examYear || row.ano) : null,
      statement: String(row.statement || row.enunciado || row.question || row.questao || '').trim(),
      alternatives,
      correctAnswer: String(row.correctAnswer || row.gabarito || row.answer || '').trim(),
      explanation: String(row.explanation || row.comentario || row.justificativa || '').trim(),
      legalBasis: String(row.legalBasis || row.baseLegal || row.fundamentoLegal || '').trim(),
      sourceUrl: String(row.sourceUrl || row.url || '').trim(),
      source: String(row.source || row.fonte || '').trim(),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : row.tag ? [String(row.tag)] : [],
    };
  });
}

export async function markQuestionDuplicates(client: SupabaseClient, profileId: string, rows: QuestionImportCandidate[]): Promise<QuestionImportCandidate[]> {
  const { data, error } = await client.from('questions').select('statement').eq('profile_id', profileId).is('deleted_at', null);
  if (error) throw error;
  const existing = new Set((data || []).map((row: any) => normalizeText(row.statement)));
  const local = new Set<string>();
  return rows.map((row) => {
    const key = normalizeText(row.statement);
    if (!key) return row;
    if (existing.has(key)) return { ...row, duplicate: true, duplicateReason: 'Questão já cadastrada.' };
    if (local.has(key)) return { ...row, duplicate: true, duplicateReason: 'Duplicada neste arquivo.' };
    local.add(key);
    return { ...row, duplicate: false };
  });
}

export async function importQuestions(client: SupabaseClient, user: User, profileId: string, rows: QuestionImportCandidate[]) {
  let inserted = 0;
  let duplicates = rows.filter((row) => row.duplicate).length;
  let failed = 0;
  for (const row of rows.filter((item) => !item.duplicate && item.statement.trim())) {
    try { await createQuestion(client, user, profileId, row); inserted += 1; }
    catch (cause) { if (cause instanceof Error && cause.message === 'question-duplicate') duplicates += 1; else failed += 1; }
  }
  return { inserted, duplicates, failed };
}

function normalizeAlternatives(value: unknown): Array<{ key: string; text: string }> {
  if (Array.isArray(value)) return value.map((item, index) => typeof item === 'string' ? { key: String.fromCharCode(65 + index), text: item } : item && typeof item === 'object' ? { key: String((item as any).key || (item as any).label || String.fromCharCode(65 + index)), text: String((item as any).text || (item as any).value || '') } : null).filter(Boolean) as Array<{key:string;text:string}>;
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, text]) => ({ key, text: String(text) }));
  return [];
}
function normalizeText(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
function normalizeQuestionError(error: any) { if (String(error?.code) === '23505' || /duplicate|unique/i.test(String(error?.message || ''))) return new Error('question-duplicate'); return error instanceof Error ? error : new Error(String(error?.message || error)); }
