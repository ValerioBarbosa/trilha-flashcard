-- Garantias para reexecutar a migração local -> relacional sem duplicar entidades.

create unique index if not exists idx_cards_legacy_identity
  on public.cards(user_id, deck_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists idx_topics_subject_parent_slug_nd
  on public.topics(subject_id, parent_id, slug) nulls not distinct;
