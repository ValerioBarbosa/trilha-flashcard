do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cards_legacy_identity_unique'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_legacy_identity_unique unique (user_id, deck_id, legacy_id);
  end if;
end $$;
