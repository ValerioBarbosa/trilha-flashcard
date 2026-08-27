begin;
select plan(13);

select has_table('public', 'flashcard_sync_entries', 'sync table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.flashcard_sync_entries'::regclass),
  'RLS is enabled'
);
select ok(
  not has_table_privilege('anon', 'public.flashcard_sync_entries', 'select,insert,update,delete'),
  'anonymous clients have no table privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.flashcard_sync_entries', 'select,insert,update,delete'),
  'authenticated clients have required privileges'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.com', '', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.com', '', now(), now());

insert into public.flashcard_sync_entries (user_id, storage_key, storage_value, content_hash)
values
  ('10000000-0000-0000-0000-000000000001', 'trilha-flashcard-state', '{}', 'hash-one'),
  ('20000000-0000-0000-0000-000000000002', 'trilha-flashcard-state', '{}', 'hash-two');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$select content_hash from public.flashcard_sync_entries order by content_hash$$,
  array['hash-one'],
  'a user reads only their own row'
);
select lives_ok(
  $$insert into public.flashcard_sync_entries (user_id, storage_key, storage_value, content_hash) values ('10000000-0000-0000-0000-000000000001', 'trilha-flashcard-trash', '[]', 'own-insert')$$,
  'a user inserts their own row'
);
select throws_ok(
  $$insert into public.flashcard_sync_entries (user_id, storage_key, storage_value, content_hash) values ('20000000-0000-0000-0000-000000000002', 'trilha-flashcard-trash', '[]', 'foreign-insert')$$,
  '42501', null, 'a user cannot insert another owner row'
);
select lives_ok(
  $$update public.flashcard_sync_entries set storage_value = '{"ok":true}' where user_id = '10000000-0000-0000-0000-000000000001' and storage_key = 'trilha-flashcard-state'$$,
  'a user updates their own row'
);
select results_eq(
  $$select count(*)::bigint from public.flashcard_sync_entries where content_hash = 'hash-two' and storage_value = '{"ok":true}'$$,
  array[0::bigint],
  'a user cannot update another owner row'
);
select throws_ok(
  $$update public.flashcard_sync_entries set user_id = '20000000-0000-0000-0000-000000000002' where user_id = '10000000-0000-0000-0000-000000000001' and storage_key = 'trilha-flashcard-state'$$,
  '42501', null, 'a user cannot transfer row ownership'
);
select lives_ok(
  $$delete from public.flashcard_sync_entries where user_id = '10000000-0000-0000-0000-000000000001' and storage_key = 'trilha-flashcard-trash'$$,
  'a user deletes their own row'
);
select results_eq(
  $$select count(*)::bigint from public.flashcard_sync_entries where user_id = '20000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'another user row is invisible'
);
select throws_ok(
  $$insert into public.flashcard_sync_entries (user_id, storage_key, storage_value, content_hash) values ('10000000-0000-0000-0000-000000000001', 'unrelated-key', '{}', 'bad-key')$$,
  '23514', null, 'only application-owned keys are accepted'
);

reset role;
select * from finish();
rollback;
