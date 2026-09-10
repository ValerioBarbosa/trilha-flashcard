import type { SupabaseClient, User } from '@supabase/supabase-js';

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  profile: { id: string; name: string; slug: string };
  subjects: Array<Record<string, unknown>>;
  topics: Array<Record<string, unknown>>;
  decks: Array<Record<string, unknown>>;
  cards: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
};

export type RestoreReport = {
  subjects: number;
  topics: number;
  decks: number;
  cards: number;
};

const SUBJECT_COLUMNS = 'id,name,slug,weight,priority,sort_order';
const TOPIC_COLUMNS = 'id,subject_id,parent_id,name,slug,edital_text,legal_basis,priority,sort_order';
const DECK_COLUMNS = 'id,subject_id,name,slug,description,source,is_builtin,is_archived';
const CARD_COLUMNS = 'id,deck_id,subject_id,topic_id,front,back,card_type,legal_basis,example,complement,pitfall,mnemonic,priority,difficulty,tags,suspended';
const REVIEW_COLUMNS = 'card_id,rating,response_ms,interval_days,due_at,reviewed_at,algorithm';
const ERROR_COLUMNS = 'subject_id,topic_id,card_id,kind,title,note,correction,legal_basis,resolved,resolved_at';

async function fetchAll(client: SupabaseClient, table: string, columns: string, profileId: string): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await client.from(table).select(columns).eq('profile_id', profileId);
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

export async function exportBackup(
  client: SupabaseClient,
  profile: { id: string; name: string; slug: string },
): Promise<BackupPayload> {
  async function fetchCards() {
    const { data, error } = await client.from('cards').select(CARD_COLUMNS).eq('profile_id', profile.id).is('deleted_at', null);
    if (error) throw error;
    return (data ?? []) as unknown as Array<Record<string, unknown>>;
  }

  const [subjects, topics, decks, cardsRaw, reviews, errors] = await Promise.all([
    fetchAll(client, 'subjects', SUBJECT_COLUMNS, profile.id),
    fetchAll(client, 'topics', TOPIC_COLUMNS, profile.id),
    fetchAll(client, 'decks', DECK_COLUMNS, profile.id),
    fetchCards(),
    fetchAll(client, 'reviews', REVIEW_COLUMNS, profile.id),
    fetchAll(client, 'error_notebook', ERROR_COLUMNS, profile.id),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: { id: profile.id, name: profile.name, slug: profile.slug },
    subjects,
    topics,
    decks,
    cards: cardsRaw,
    reviews,
    errors,
  };
}

export function downloadBackupFile(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = payload.exportedAt.slice(0, 10);
  link.href = url;
  link.download = `trilha-backup-${payload.profile.slug}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(text: string): BackupPayload {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1 || !parsed.profile?.id || !Array.isArray(parsed.cards)) {
    throw new Error('Arquivo de backup inválido ou de uma versão não suportada.');
  }
  return parsed as BackupPayload;
}

export async function restoreBackup(
  client: SupabaseClient,
  user: User,
  profileId: string,
  payload: BackupPayload,
): Promise<RestoreReport> {
  if (payload.profile.id !== profileId) {
    throw new Error(`Este backup pertence ao perfil "${payload.profile.name}". Troque para esse perfil antes de restaurar.`);
  }

  async function upsertAll(table: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) return 0;
    const prepared = rows.map((row) => ({ ...row, user_id: user.id, profile_id: profileId }));
    for (let start = 0; start < prepared.length; start += 200) {
      const { error } = await client.from(table).upsert(prepared.slice(start, start + 200), { onConflict: 'id' });
      if (error) throw error;
    }
    return rows.length;
  }

  const subjects = await upsertAll('subjects', payload.subjects);
  const topics = await upsertAll('topics', payload.topics);
  const decks = await upsertAll('decks', payload.decks);
  const cards = await upsertAll('cards', payload.cards);

  return { subjects, topics, decks, cards };
}
