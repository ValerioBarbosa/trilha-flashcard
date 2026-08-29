-- Trilha Flashcard: modelo relacional normalizado para a nova arquitetura.
-- Mantém flashcard_sync_entries como camada de compatibilidade durante a migração.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.study_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  role text,
  board text,
  edital_year text,
  is_builtin boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  weight numeric(7,4),
  priority text check (priority is null or priority in ('A','B','C')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  parent_id uuid references public.topics(id) on delete cascade,
  name text not null,
  slug text not null,
  edital_text text,
  legal_basis text,
  priority text check (priority is null or priority in ('A','B','C')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, parent_id, slug)
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  source text,
  is_builtin boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  legacy_id text,
  front text not null,
  back text not null,
  card_type text,
  legal_basis text,
  example text,
  complement text,
  pitfall text,
  mnemonic text,
  priority text check (priority is null or priority in ('A','B','C')),
  difficulty text check (difficulty is null or difficulty in ('easy','medium','hard')),
  tags text[] not null default '{}',
  source text,
  source_page integer,
  suspended boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  due_at timestamptz,
  interval_days numeric(10,3),
  ease numeric(8,4),
  stability numeric(12,6),
  difficulty numeric(12,6),
  elapsed_days numeric(10,3),
  scheduled_days numeric(10,3),
  response_ms integer check (response_ms is null or response_ms >= 0),
  algorithm text not null default 'legacy',
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  board text,
  exam text,
  exam_year integer,
  statement text not null,
  alternatives jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  legal_basis text,
  source_url text,
  source text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer text,
  is_correct boolean,
  response_ms integer check (response_ms is null or response_ms >= 0),
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.jurisprudence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  court text not null,
  body text,
  theme text,
  process_number text,
  thesis text not null,
  summary text,
  legal_basis text,
  exam_angle text,
  pitfall text,
  judgment_date date,
  bulletin text,
  status text not null default 'vigente' check (status in ('vigente','superado','modulado','cancelado','pendente')),
  source_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.error_notebook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  kind text not null default 'manual' check (kind in ('manual','card','question','jurisprudence')),
  title text not null,
  note text,
  correction text,
  legal_basis text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint error_notebook_source check (card_id is not null or question_id is not null or kind = 'manual' or kind = 'jurisprudence')
);

create index if not exists idx_study_profiles_user on public.study_profiles(user_id, is_archived);
create index if not exists idx_subjects_profile on public.subjects(profile_id, sort_order);
create index if not exists idx_topics_subject on public.topics(subject_id, sort_order);
create index if not exists idx_decks_profile on public.decks(profile_id, is_archived);
create index if not exists idx_cards_deck on public.cards(deck_id) where deleted_at is null;
create index if not exists idx_cards_topic on public.cards(topic_id) where deleted_at is null;
create index if not exists idx_cards_user_updated on public.cards(user_id, updated_at desc);
create index if not exists idx_reviews_card_date on public.reviews(card_id, reviewed_at desc);
create index if not exists idx_reviews_user_date on public.reviews(user_id, reviewed_at desc);
create index if not exists idx_questions_topic on public.questions(topic_id);
create index if not exists idx_attempts_question_date on public.question_attempts(question_id, attempted_at desc);
create index if not exists idx_attempts_user_date on public.question_attempts(user_id, attempted_at desc);
create index if not exists idx_jurisprudence_topic on public.jurisprudence(topic_id, judgment_date desc);
create index if not exists idx_error_notebook_open on public.error_notebook(user_id, resolved, created_at desc);

-- Garante que filhos não possam apontar para entidades de outro usuário/perfil.
create or replace function public.guard_study_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid;
  parent_profile uuid;
begin
  if tg_table_name = 'subjects' then
    select user_id into owner from public.study_profiles where id = new.profile_id;
    if owner is distinct from new.user_id then raise exception 'study-scope-owner-mismatch'; end if;
  elsif tg_table_name = 'topics' then
    select user_id, profile_id into owner, parent_profile from public.subjects where id = new.subject_id;
    if owner is distinct from new.user_id or parent_profile is distinct from new.profile_id then raise exception 'study-scope-subject-mismatch'; end if;
  elsif tg_table_name = 'decks' then
    select user_id into owner from public.study_profiles where id = new.profile_id;
    if owner is distinct from new.user_id then raise exception 'study-scope-owner-mismatch'; end if;
  elsif tg_table_name = 'cards' then
    select user_id, profile_id into owner, parent_profile from public.decks where id = new.deck_id;
    if owner is distinct from new.user_id or parent_profile is distinct from new.profile_id then raise exception 'study-scope-deck-mismatch'; end if;
  elsif tg_table_name = 'reviews' then
    select user_id, profile_id into owner, parent_profile from public.cards where id = new.card_id;
    if owner is distinct from new.user_id or parent_profile is distinct from new.profile_id then raise exception 'study-scope-card-mismatch'; end if;
  elsif tg_table_name = 'question_attempts' then
    select user_id, profile_id into owner, parent_profile from public.questions where id = new.question_id;
    if owner is distinct from new.user_id or parent_profile is distinct from new.profile_id then raise exception 'study-scope-question-mismatch'; end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'study_profiles_set_updated_at') then
    create trigger study_profiles_set_updated_at before update on public.study_profiles for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'subjects_set_updated_at') then
    create trigger subjects_set_updated_at before update on public.subjects for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'topics_set_updated_at') then
    create trigger topics_set_updated_at before update on public.topics for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'decks_set_updated_at') then
    create trigger decks_set_updated_at before update on public.decks for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'cards_set_updated_at') then
    create trigger cards_set_updated_at before update on public.cards for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'questions_set_updated_at') then
    create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'jurisprudence_set_updated_at') then
    create trigger jurisprudence_set_updated_at before update on public.jurisprudence for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'error_notebook_set_updated_at') then
    create trigger error_notebook_set_updated_at before update on public.error_notebook for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'subjects_guard_scope') then
    create trigger subjects_guard_scope before insert or update on public.subjects for each row execute function public.guard_study_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'topics_guard_scope') then
    create trigger topics_guard_scope before insert or update on public.topics for each row execute function public.guard_study_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'decks_guard_scope') then
    create trigger decks_guard_scope before insert or update on public.decks for each row execute function public.guard_study_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'cards_guard_scope') then
    create trigger cards_guard_scope before insert or update on public.cards for each row execute function public.guard_study_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'reviews_guard_scope') then
    create trigger reviews_guard_scope before insert or update on public.reviews for each row execute function public.guard_study_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'attempts_guard_scope') then
    create trigger attempts_guard_scope before insert or update on public.question_attempts for each row execute function public.guard_study_scope();
  end if;
end $$;

alter table public.study_profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.reviews enable row level security;
alter table public.questions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.jurisprudence enable row level security;
alter table public.error_notebook enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'study_profiles','subjects','topics','decks','cards','reviews','questions','question_attempts','jurisprudence','error_notebook'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', table_name || '_delete_own', table_name);
  end loop;
end $$;
