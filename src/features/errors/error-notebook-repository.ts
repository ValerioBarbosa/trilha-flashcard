import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ErrorNotebookRow = {
  id: string;
  profile_id: string;
  subject_id: string | null;
  topic_id: string | null;
  card_id: string | null;
  question_id: string | null;
  kind: 'manual' | 'card' | 'question' | 'jurisprudence';
  title: string;
  note: string | null;
  correction: string | null;
  legal_basis: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listErrorNotebook(client: SupabaseClient, profileId: string): Promise<ErrorNotebookRow[]> {
  const { data, error } = await client.from('error_notebook')
    .select('id,profile_id,subject_id,topic_id,card_id,question_id,kind,title,note,correction,legal_basis,resolved,resolved_at,created_at,updated_at')
    .eq('profile_id', profileId)
    .order('resolved', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ErrorNotebookRow[];
}

export async function createManualError(
  client: SupabaseClient,
  user: User,
  profileId: string,
  input: { subjectId?: string; topicId?: string; title: string; note?: string; correction?: string; legalBasis?: string },
): Promise<void> {
  const { error } = await client.from('error_notebook').insert({
    user_id: user.id,
    profile_id: profileId,
    subject_id: input.subjectId || null,
    topic_id: input.topicId || null,
    kind: 'manual',
    title: input.title.trim(),
    note: input.note?.trim() || null,
    correction: input.correction?.trim() || null,
    legal_basis: input.legalBasis?.trim() || null,
    resolved: false,
  });
  if (error) throw error;
}

export async function setErrorResolved(client: SupabaseClient, id: string, resolved: boolean): Promise<void> {
  const { error } = await client.from('error_notebook').update({
    resolved,
    resolved_at: resolved ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteManualError(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('error_notebook').delete().eq('id', id).eq('kind', 'manual');
  if (error) throw error;
}
