import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { CardRow, DeckRow, SubjectRow, TopicRow } from '../study/domain-repository';

export type ManagedCard = CardRow & {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  suspended: boolean;
  source: string | null;
  source_page: number | null;
};

export type CardDraft = {
  deckId: string;
  subjectId: string;
  topicId?: string | null;
  front: string;
  back: string;
  legalBasis?: string;
  example?: string;
  complement?: string;
  pitfall?: string;
  mnemonic?: string;
  priority?: 'A' | 'B' | 'C' | '';
  difficulty?: 'easy' | 'medium' | 'hard' | '';
  tags?: string[];
  cardType?: string;
  source?: string;
};

export type ImportCandidate = CardDraft & { row: number; duplicate?: boolean; duplicateReason?: string };

export async function listManagedCards(client: SupabaseClient, profileId: string): Promise<ManagedCard[]> {
  const { data, error } = await client.from('cards')
    .select('id,deck_id,subject_id,topic_id,front,back,card_type,legal_basis,example,complement,pitfall,mnemonic,priority,difficulty,tags,source,source_page,suspended,deleted_at,created_at,updated_at')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ManagedCard[];
}

export async function createCard(client: SupabaseClient, user: User, profileId: string, draft: CardDraft): Promise<ManagedCard> {
  const { data, error } = await client.from('cards').insert({
    user_id: user.id,
    profile_id: profileId,
    deck_id: draft.deckId,
    subject_id: draft.subjectId,
    topic_id: draft.topicId || null,
    front: draft.front.trim(),
    back: draft.back.trim(),
    legal_basis: draft.legalBasis?.trim() || null,
    example: draft.example?.trim() || null,
    complement: draft.complement?.trim() || null,
    pitfall: draft.pitfall?.trim() || null,
    mnemonic: draft.mnemonic?.trim() || null,
    priority: draft.priority || null,
    difficulty: draft.difficulty || null,
    tags: draft.tags || [],
    card_type: draft.cardType?.trim() || null,
    source: draft.source?.trim() || null,
    suspended: false,
    deleted_at: null,
  }).select('id,deck_id,subject_id,topic_id,front,back,card_type,legal_basis,example,complement,pitfall,mnemonic,priority,difficulty,tags,source,source_page,suspended,deleted_at,created_at,updated_at').single();
  if (error) throw normalizeCardError(error);
  return data as ManagedCard;
}

export async function updateCard(client: SupabaseClient, cardId: string, draft: CardDraft): Promise<void> {
  const { error } = await client.from('cards').update({
    deck_id: draft.deckId,
    subject_id: draft.subjectId,
    topic_id: draft.topicId || null,
    front: draft.front.trim(),
    back: draft.back.trim(),
    legal_basis: draft.legalBasis?.trim() || null,
    example: draft.example?.trim() || null,
    complement: draft.complement?.trim() || null,
    pitfall: draft.pitfall?.trim() || null,
    mnemonic: draft.mnemonic?.trim() || null,
    priority: draft.priority || null,
    difficulty: draft.difficulty || null,
    tags: draft.tags || [],
    card_type: draft.cardType?.trim() || null,
    source: draft.source?.trim() || null,
  }).eq('id', cardId);
  if (error) throw normalizeCardError(error);
}

export async function softDeleteCard(client: SupabaseClient, cardId: string): Promise<void> {
  const { error } = await client.from('cards').update({ deleted_at: new Date().toISOString() }).eq('id', cardId);
  if (error) throw error;
}

export async function restoreCard(client: SupabaseClient, cardId: string): Promise<void> {
  const { error } = await client.from('cards').update({ deleted_at: null }).eq('id', cardId);
  if (error) throw normalizeCardError(error);
}

export async function setCardSuspended(client: SupabaseClient, cardId: string, suspended: boolean): Promise<void> {
  const { error } = await client.from('cards').update({ suspended }).eq('id', cardId);
  if (error) throw error;
}

export async function findDuplicateContent(client: SupabaseClient, profileId: string, front: string, back: string): Promise<boolean> {
  const normalizedFront = front.trim().toLowerCase();
  const normalizedBack = back.trim().toLowerCase();
  const { data, error } = await client.from('cards').select('front,back').eq('profile_id', profileId).is('deleted_at', null);
  if (error) throw error;
  return (data || []).some((row: any) => row.front.trim().toLowerCase() === normalizedFront && row.back.trim().toLowerCase() === normalizedBack);
}

export async function importCards(client: SupabaseClient, user: User, profileId: string, candidates: ImportCandidate[]) {
  const accepted = candidates.filter((candidate) => !candidate.duplicate && candidate.front.trim() && candidate.back.trim());
  if (!accepted.length) return { inserted: 0, duplicates: candidates.filter((row) => row.duplicate).length, failed: 0 };

  let inserted = 0;
  let failed = 0;
  for (const candidate of accepted) {
    try {
      await createCard(client, user, profileId, candidate);
      inserted += 1;
    } catch (error) {
      if (error instanceof Error && error.message === 'card-duplicate') continue;
      failed += 1;
    }
  }
  return { inserted, duplicates: candidates.filter((row) => row.duplicate).length + (accepted.length - inserted - failed), failed };
}

export function parseJsonImport(text: string, defaults: { deckId: string; subjectId: string }): ImportCandidate[] {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : [];
  return rows.map((row: any, index: number) => ({
    row: index + 1,
    deckId: String(row.deckId || defaults.deckId),
    subjectId: String(row.subjectId || row.disciplineId || defaults.subjectId),
    topicId: row.topicId || null,
    front: String(row.front || row.pergunta || row.question || '').trim(),
    back: String(row.back || row.resposta || row.answer || '').trim(),
    legalBasis: String(row.legalBasis || row.baseLegal || '').trim(),
    example: String(row.example || row.exemplo || '').trim(),
    complement: String(row.complement || row.complemento || '').trim(),
    pitfall: String(row.pitfall || row.pegadinha || '').trim(),
    mnemonic: String(row.mnemonic || row.mnemonico || '').trim(),
    priority: ['A','B','C'].includes(String(row.priority || row.prioridade || '').toUpperCase()) ? String(row.priority || row.prioridade).toUpperCase() as 'A'|'B'|'C' : '',
    difficulty: ['easy','medium','hard'].includes(String(row.difficulty || row.dificuldade || '').toLowerCase()) ? String(row.difficulty || row.dificuldade).toLowerCase() as 'easy'|'medium'|'hard' : '',
    tags: Array.isArray(row.tags) ? row.tags.map(String) : row.tag ? [String(row.tag)] : [],
    cardType: String(row.cardType || row.tipo || '').trim(),
    source: String(row.source || row.fonte || '').trim(),
  }));
}

export async function markImportDuplicates(client: SupabaseClient, profileId: string, candidates: ImportCandidate[]): Promise<ImportCandidate[]> {
  const { data, error } = await client.from('cards').select('front,back').eq('profile_id', profileId).is('deleted_at', null);
  if (error) throw error;
  const existing = new Set((data || []).map((row: any) => contentKey(row.front, row.back)));
  const withinImport = new Set<string>();
  return candidates.map((candidate) => {
    const key = contentKey(candidate.front, candidate.back);
    if (!candidate.front || !candidate.back) return { ...candidate, duplicate: false };
    if (existing.has(key)) return { ...candidate, duplicate: true, duplicateReason: 'Já existe no seu banco.' };
    if (withinImport.has(key)) return { ...candidate, duplicate: true, duplicateReason: 'Duplicado neste arquivo.' };
    withinImport.add(key);
    return { ...candidate, duplicate: false };
  });
}

function contentKey(front: string, back: string) { return `${front.trim().toLowerCase()}|${back.trim().toLowerCase()}`; }
function normalizeCardError(error: any): Error {
  if (String(error?.code) === '23505' || /duplicate|unique/i.test(String(error?.message || ''))) return new Error('card-duplicate');
  return error instanceof Error ? error : new Error(String(error?.message || error));
}

export type CardManagerLookups = { subjects: SubjectRow[]; topics: TopicRow[]; decks: DeckRow[] };
