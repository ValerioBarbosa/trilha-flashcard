alter table public.error_notebook
  add column if not exists category text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'error_notebook_category_check'
      and conrelid = 'public.error_notebook'::regclass
  ) then
    alter table public.error_notebook
      add constraint error_notebook_category_check
      check (category is null or category in ('content','distraction','interpretation','lei-seca','jurisprudence'));
  end if;
end $$;
