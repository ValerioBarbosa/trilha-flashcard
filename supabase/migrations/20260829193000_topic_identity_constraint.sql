do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'topics_identity_unique'
      and conrelid = 'public.topics'::regclass
  ) then
    alter table public.topics
      add constraint topics_identity_unique
      unique nulls not distinct (subject_id, parent_id, slug);
  end if;
end $$;
