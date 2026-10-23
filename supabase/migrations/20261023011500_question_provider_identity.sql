alter table public.questions
  add column if not exists source_provider text,
  add column if not exists external_id text;

create unique index if not exists idx_questions_provider_external_active
on public.questions(user_id, profile_id, source_provider, external_id)
where deleted_at is null and source_provider is not null and external_id is not null;
