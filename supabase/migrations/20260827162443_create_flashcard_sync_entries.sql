create table public.flashcard_sync_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null check (storage_key like 'trilha-flashcard-%'),
  storage_value text,
  content_hash text not null check (length(content_hash) between 1 and 128),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, storage_key),
  constraint deleted_value_consistency check (
    (deleted and storage_value is null) or (not deleted and storage_value is not null)
  )
);

alter table public.flashcard_sync_entries enable row level security;

revoke all on table public.flashcard_sync_entries from anon, authenticated;
grant select, insert, update, delete on table public.flashcard_sync_entries to authenticated;

create policy "Users read their own flashcard sync entries"
on public.flashcard_sync_entries for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert their own flashcard sync entries"
on public.flashcard_sync_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own flashcard sync entries"
on public.flashcard_sync_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own flashcard sync entries"
on public.flashcard_sync_entries for delete
to authenticated
using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.set_flashcard_sync_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_flashcard_sync_updated_at() from public, anon, authenticated;

create trigger set_flashcard_sync_updated_at
before insert or update on public.flashcard_sync_entries
for each row execute function private.set_flashcard_sync_updated_at();

create index flashcard_sync_entries_user_updated_idx
  on public.flashcard_sync_entries (user_id, updated_at desc);
