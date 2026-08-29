alter table public.cards
  add column if not exists content_fingerprint text
  generated always as (
    md5(lower(btrim(front)) || '|' || lower(btrim(back)))
  ) stored;

create unique index if not exists idx_cards_unique_content_active
  on public.cards(user_id, profile_id, content_fingerprint)
  where deleted_at is null;

create index if not exists idx_cards_fingerprint_lookup
  on public.cards(user_id, profile_id, content_fingerprint);
