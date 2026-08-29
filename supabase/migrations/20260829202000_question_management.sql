alter table public.questions
  add column if not exists deleted_at timestamptz,
  add column if not exists content_fingerprint text
  generated always as (md5(lower(btrim(statement)))) stored;

create unique index if not exists idx_questions_unique_active
  on public.questions(user_id, profile_id, content_fingerprint)
  where deleted_at is null;

create index if not exists idx_questions_active_profile
  on public.questions(profile_id, created_at desc)
  where deleted_at is null;
