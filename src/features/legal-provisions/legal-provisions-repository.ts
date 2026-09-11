import type { SupabaseClient } from '@supabase/supabase-js';

export type LegalProvisionRow = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  law_name: string;
  articles: string;
  focus: string | null;
  notes: string | null;
  tags: string[];
};

export async function listLegalProvisions(client: SupabaseClient, profileId: string): Promise<LegalProvisionRow[]> {
  const { data, error } = await client.from('legal_provisions')
    .select('id,subject_id,topic_id,law_name,articles,focus,notes,tags')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as LegalProvisionRow[];
}
