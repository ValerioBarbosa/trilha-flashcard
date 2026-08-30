import type { SupabaseClient } from '@supabase/supabase-js';
import type { JurisprudenceRow } from '../study/domain-repository';

export async function listJurisprudence(client: SupabaseClient, profileId: string): Promise<JurisprudenceRow[]> {
  const { data, error } = await client.from('jurisprudence')
    .select('id,subject_id,topic_id,court,body,theme,process_number,thesis,summary,legal_basis,exam_angle,pitfall,judgment_date,bulletin,status')
    .eq('profile_id', profileId)
    .order('judgment_date', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as JurisprudenceRow[];
}
