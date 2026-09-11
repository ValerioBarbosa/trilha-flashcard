-- Lei Seca: caderno de artigos críticos por norma, vinculado opcionalmente a uma matéria/assunto.
create table if not exists public.legal_provisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.study_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  law_name text not null,
  articles text not null,
  focus text,
  notes text,
  sort_order integer not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_legal_provisions_user on public.legal_provisions(user_id);
create index if not exists idx_legal_provisions_profile on public.legal_provisions(profile_id, sort_order);
create index if not exists idx_legal_provisions_subject on public.legal_provisions(subject_id) where subject_id is not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'legal_provisions_set_updated_at') then
    create trigger legal_provisions_set_updated_at before update on public.legal_provisions for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.legal_provisions enable row level security;

do $$
declare
  table_name text := 'legal_provisions';
begin
  execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
  execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
  execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
  execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
  execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', table_name || '_select_own', table_name);
  execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', table_name || '_insert_own', table_name);
  execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_update_own', table_name);
  execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', table_name || '_delete_own', table_name);
end $$;
