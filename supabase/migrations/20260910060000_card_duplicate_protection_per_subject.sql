-- Restringe a proteção contra cartões duplicados à mesma disciplina, em vez do perfil
-- inteiro. Duas disciplinas diferentes podem legitimamente ter um cartão com o mesmo
-- enunciado/resposta (ex.: um conceito revisitado em outro contexto).

drop index if exists public.idx_cards_unique_content_active;
drop index if exists public.idx_cards_fingerprint_lookup;

create unique index if not exists idx_cards_unique_content_active
  on public.cards(user_id, subject_id, content_fingerprint)
  where deleted_at is null;

create index if not exists idx_cards_fingerprint_lookup
  on public.cards(user_id, subject_id, content_fingerprint);
