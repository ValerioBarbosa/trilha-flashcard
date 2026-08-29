create index if not exists idx_error_notebook_card_open
  on public.error_notebook(user_id, card_id)
  where card_id is not null and resolved = false;

create index if not exists idx_error_notebook_question_open
  on public.error_notebook(user_id, question_id)
  where question_id is not null and resolved = false;

create or replace function public.capture_card_review_error()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  card_row public.cards%rowtype;
  existing_id uuid;
begin
  if new.rating > 2 then
    return new;
  end if;

  select * into card_row from public.cards where id = new.card_id;
  if card_row.id is null then return new; end if;

  select id into existing_id
  from public.error_notebook
  where user_id = new.user_id
    and card_id = new.card_id
    and resolved = false
  order by created_at desc
  limit 1;

  if existing_id is null then
    insert into public.error_notebook (
      user_id, profile_id, subject_id, topic_id, card_id, kind,
      title, note, correction, legal_basis
    ) values (
      new.user_id, new.profile_id, card_row.subject_id, card_row.topic_id, card_row.id, 'card',
      card_row.front,
      case when new.rating = 1 then 'Cartão marcado como Errei.' else 'Cartão marcado como Difícil.' end,
      card_row.back,
      card_row.legal_basis
    );
  else
    update public.error_notebook
    set note = case when new.rating = 1 then 'Cartão marcado novamente como Errei.' else 'Cartão marcado novamente como Difícil.' end,
        correction = card_row.back,
        legal_basis = card_row.legal_basis,
        updated_at = now()
    where id = existing_id;
  end if;

  return new;
end;
$$;

create or replace function public.capture_question_attempt_error()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  question_row public.questions%rowtype;
  existing_id uuid;
begin
  if new.is_correct is distinct from false then
    return new;
  end if;

  select * into question_row from public.questions where id = new.question_id;
  if question_row.id is null then return new; end if;

  select id into existing_id
  from public.error_notebook
  where user_id = new.user_id
    and question_id = new.question_id
    and resolved = false
  order by created_at desc
  limit 1;

  if existing_id is null then
    insert into public.error_notebook (
      user_id, profile_id, subject_id, topic_id, question_id, kind,
      title, note, correction, legal_basis
    ) values (
      new.user_id, new.profile_id, question_row.subject_id, question_row.topic_id, question_row.id, 'question',
      question_row.statement,
      'Resposta marcada: ' || coalesce(new.answer, 'sem resposta'),
      coalesce(question_row.explanation, question_row.correct_answer, 'Revisar o gabarito.'),
      question_row.legal_basis
    );
  else
    update public.error_notebook
    set note = 'Erro repetido. Resposta marcada: ' || coalesce(new.answer, 'sem resposta'),
        correction = coalesce(question_row.explanation, question_row.correct_answer, 'Revisar o gabarito.'),
        legal_basis = question_row.legal_basis,
        updated_at = now()
    where id = existing_id;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_capture_error on public.reviews;
create trigger reviews_capture_error
after insert on public.reviews
for each row execute function public.capture_card_review_error();

drop trigger if exists attempts_capture_error on public.question_attempts;
create trigger attempts_capture_error
after insert on public.question_attempts
for each row execute function public.capture_question_attempt_error();
