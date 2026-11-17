-- profile_collections: a person's shown collections, and nothing private.
set client_min_messages = notice;

create schema profile_tests;

create function profile_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;
grant usage on schema profile_tests to anon, authenticated;
grant execute on function profile_tests.check(boolean, text) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-aa00-00000000000a', 'ana-profile@test', '{"handle":"ana_profile"}'),
  ('00000000-0000-4000-aa00-00000000000b', 'ben-profile@test', '{"handle":"ben_profile"}');

insert into public.scan_history (id, user_id, item_name, amount_php, low_php, high_php, paid_php)
values
  ('00000000-0000-4000-ab00-000000000001', '00000000-0000-4000-aa00-00000000000a',
   'Film camera', 3000, 2500, 3500, 900),
  ('00000000-0000-4000-ab00-000000000002', '00000000-0000-4000-aa00-00000000000a',
   'Walkman', 2000, 1500, 2500, null),
  ('00000000-0000-4000-ab00-000000000003', '00000000-0000-4000-aa00-00000000000a',
   'Secret thing', 9000, 8000, 10000, null);

insert into public.collections (id, user_id, name, shown_on_profile) values
  ('00000000-0000-4000-ac00-000000000001', '00000000-0000-4000-aa00-00000000000a',
   'Retro tech', true),
  ('00000000-0000-4000-ac00-000000000002', '00000000-0000-4000-aa00-00000000000a',
   'Private stash', false);

insert into public.collection_items (collection_id, scan_id, user_id) values
  ('00000000-0000-4000-ac00-000000000001', '00000000-0000-4000-ab00-000000000001',
   '00000000-0000-4000-aa00-00000000000a'),
  ('00000000-0000-4000-ac00-000000000001', '00000000-0000-4000-ab00-000000000002',
   '00000000-0000-4000-aa00-00000000000a'),
  ('00000000-0000-4000-ac00-000000000002', '00000000-0000-4000-ab00-000000000003',
   '00000000-0000-4000-aa00-00000000000a');

-- A signed-out visitor sees Ana's shown collection, with its count and total.
set role anon;
select profile_tests.check(
  (select count(*) = 1 from public.profile_collections('00000000-0000-4000-aa00-00000000000a')),
  'only the collection Ana shows is on her profile'
);
select profile_tests.check(
  (select item_count = 2 and total_php = 5000
     from public.profile_collections('00000000-0000-4000-aa00-00000000000a')),
  'it carries how many things are in it and what they are worth together'
);
select profile_tests.check(
  (select not ('Secret thing' = any (item_names))
     from public.profile_collections('00000000-0000-4000-aa00-00000000000a')),
  'nothing from a hidden collection leaks into it'
);
select profile_tests.check(
  (select count(*) = 0 from public.profile_collections('00000000-0000-4000-aa00-00000000000b')),
  'someone who shows nothing has nothing on their profile'
);

-- The tables themselves stay closed to anyone but the owner.
select profile_tests.check(
  not has_table_privilege('anon', 'public.collections', 'select'),
  'signed-out visitors still cannot read the collections table'
);

reset role;
drop schema profile_tests cascade;
delete from public.collections where user_id = '00000000-0000-4000-aa00-00000000000a';
delete from public.scan_history where user_id = '00000000-0000-4000-aa00-00000000000a';
delete from auth.users where id in (
  '00000000-0000-4000-aa00-00000000000a', '00000000-0000-4000-aa00-00000000000b'
);
