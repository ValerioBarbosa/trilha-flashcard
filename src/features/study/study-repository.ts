import type { SupabaseClient, User } from '@supabase/supabase-js';

export type StudyProfile = {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  board: string | null;
  edital_year: string | null;
  is_builtin: boolean;
};

export type NewProfileInput = {
  name: string;
  role?: string;
  board?: string;
  editalYear?: string;
};

const DEFAULT_PROFILE = {
  slug: 'trt4-ajaj',
  name: 'TRT-4 · AJAJ',
  role: 'Analista Judiciário · Área Judiciária',
  board: 'FCC',
  edital_year: '2026',
  is_builtin: true,
};

const PROFILE_COLUMNS = 'id,slug,name,role,board,edital_year,is_builtin';

function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return normalized || `perfil-${Date.now().toString(36)}`;
}

export async function ensureDefaultProfile(client: SupabaseClient, user: User): Promise<StudyProfile> {
  const { data: existing, error: readError } = await client
    .from('study_profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .eq('slug', DEFAULT_PROFILE.slug)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing as StudyProfile;

  const { data, error } = await client
    .from('study_profiles')
    .insert({ ...DEFAULT_PROFILE, user_id: user.id })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return data as StudyProfile;
}

export async function createStudyProfile(client: SupabaseClient, user: User, input: NewProfileInput): Promise<StudyProfile> {
  const name = input.name.trim();
  if (!name) throw new Error('Informe um nome para o perfil.');
  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const { data: taken, error: readError } = await client
      .from('study_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', slug)
      .maybeSingle();
    if (readError) throw readError;
    if (!taken) break;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const { data, error } = await client
    .from('study_profiles')
    .insert({
      user_id: user.id,
      slug,
      name,
      role: input.role?.trim() || null,
      board: input.board?.trim() || null,
      edital_year: input.editalYear?.trim() || null,
      is_builtin: false,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return data as StudyProfile;
}
