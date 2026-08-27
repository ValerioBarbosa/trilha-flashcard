create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_flashcard_sync_updated_at()
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

drop trigger if exists set_flashcard_sync_updated_at on public.flashcard_sync_entries;
create trigger set_flashcard_sync_updated_at
before insert or update on public.flashcard_sync_entries
for each row execute function private.set_flashcard_sync_updated_at();
