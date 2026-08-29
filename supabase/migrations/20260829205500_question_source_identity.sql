alter table public.questions
  add column if not exists source_provider text,
  add column if not exists external_id text;

update public.questions
set source_provider = nullif(btrim(source), '')
where source_provider is null
  and nullif(btrim(source), '') is not null;

create unique index if not exists idx_questions_external_identity_active
  on public.questions(user_id, profile_id, source_provider, external_id)
  where deleted_at is null
    and source_provider is not null
    and external_id is not null;

create index if not exists idx_questions_source_provider_active
  on public.questions(profile_id, source_provider, created_at desc)
  where deleted_at is null;
