-- Otimizações apontadas pelo Supabase Advisor após criação do domínio normalizado.

create index if not exists idx_subjects_user on public.subjects(user_id);
create index if not exists idx_topics_user on public.topics(user_id);
create index if not exists idx_topics_profile on public.topics(profile_id);
create index if not exists idx_topics_parent on public.topics(parent_id) where parent_id is not null;
create index if not exists idx_decks_user on public.decks(user_id);
create index if not exists idx_decks_subject on public.decks(subject_id) where subject_id is not null;
create index if not exists idx_cards_profile on public.cards(profile_id);
create index if not exists idx_cards_subject on public.cards(subject_id) where subject_id is not null;
create index if not exists idx_reviews_profile on public.reviews(profile_id);
create index if not exists idx_questions_user on public.questions(user_id);
create index if not exists idx_questions_profile on public.questions(profile_id);
create index if not exists idx_questions_subject on public.questions(subject_id) where subject_id is not null;
create index if not exists idx_attempts_profile on public.question_attempts(profile_id);
create index if not exists idx_jurisprudence_user on public.jurisprudence(user_id);
create index if not exists idx_jurisprudence_profile on public.jurisprudence(profile_id);
create index if not exists idx_jurisprudence_subject on public.jurisprudence(subject_id) where subject_id is not null;
create index if not exists idx_error_notebook_profile on public.error_notebook(profile_id);
create index if not exists idx_error_notebook_subject on public.error_notebook(subject_id) where subject_id is not null;
create index if not exists idx_error_notebook_topic on public.error_notebook(topic_id) where topic_id is not null;
create index if not exists idx_error_notebook_card on public.error_notebook(card_id) where card_id is not null;
create index if not exists idx_error_notebook_question on public.error_notebook(question_id) where question_id is not null;

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
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end $$;
