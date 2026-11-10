-- Behaviour tests for the flip tracker's prices and for Collections: both private to their owner,
-- with the limits a client cannot get around. Run with Backend/scripts/test-db.sh (local Postgres +
-- auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists collection_tests;
grant usage on schema collection_tests to anon, authenticated, service_role;

create function collection_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function collection_tests.check_rejected(statement text, codes text[], description text)
returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = any (codes) then
      raise notice 'ok - % (rejected: %)', description, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % (wrong error % %)', description, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (was allowed)', description;
end;
$$;

-- Counts the rows a statement changed, since row-level security skips others' silently.
create function collection_tests.changed(statement text) returns integer
language plpgsql as $$
declare
  rows integer;
begin
  execute statement;
  get diagnostics rows = row_count;
  return rows;
end;
$$;

grant execute on all functions in schema collection_tests to anon, authenticated, service_role;

-- Uma and Vic each have scans; Wes is only here for the limits.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-e500-00000000000a', 'uma-sets@test', '{"handle":"uma_sets"}'),
  ('00000000-0000-4000-e500-00000000000b', 'vic-sets@test', '{"handle":"vic_sets"}'),
  ('00000000-0000-4000-e500-00000000000c', 'wes-sets@test', '{"handle":"wes_sets"}');

insert into public.scan_history (id, user_id, item_name, amount_php, low_php, high_php) values
  ('00000000-0000-4000-e600-000000000001', '00000000-0000-4000-e500-00000000000a', 'Windbreaker', 2450, 2100, 2850),
  ('00000000-0000-4000-e600-000000000002', '00000000-0000-4000-e500-00000000000a', 'Puffer jacket', 2700, 2300, 3100),
  ('00000000-0000-4000-e600-000000000003', '00000000-0000-4000-e500-00000000000b', 'Film camera', 3500, 3000, 4000);

-- 1. Signed out: no prices, no collections.
set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select collection_tests.check_rejected(
  $$select count(*) from public.collections$$,
  array['42501'],
  'a signed-out visitor cannot read collections'
);
select collection_tests.check_rejected(
  $$select count(*) from public.collection_items$$,
  array['42501'],
  'a signed-out visitor cannot read what''s in collections'
);
select collection_tests.check_rejected(
  $$insert into public.collections (name) values ('Planted')$$,
  array['42501'],
  'a signed-out visitor cannot make a collection'
);
select collection_tests.check_rejected(
  $$update public.scan_history set paid_php = 1
    where id = '00000000-0000-4000-e600-000000000001'$$,
  array['42501'],
  'a signed-out visitor cannot note a price paid'
);
reset role;

-- 2. Uma notes what she paid, and makes a collection of her jackets.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e500-00000000000a', false);
select collection_tests.check(
  collection_tests.changed($$update public.scan_history set paid_php = 180
    where id = '00000000-0000-4000-e600-000000000001'$$) = 1,
  'an owner notes what they paid'
);
select collection_tests.check(
  collection_tests.changed($$update public.scan_history set paid_php = null
    where id = '00000000-0000-4000-e600-000000000002'$$) = 1,
  'an owner can clear what they paid'
);
select collection_tests.check_rejected(
  $$update public.scan_history set paid_php = -5
    where id = '00000000-0000-4000-e600-000000000001'$$,
  array['23514'],
  'a price paid below nothing is refused'
);
select collection_tests.check_rejected(
  $$update public.scan_history set paid_php = 10000001
    where id = '00000000-0000-4000-e600-000000000001'$$,
  array['23514'],
  'a price paid past ten million is refused'
);
select collection_tests.check(
  collection_tests.changed($$update public.scan_history set paid_php = 100
    where id = '00000000-0000-4000-e600-000000000003'$$) = 0,
  'nobody notes a price on someone else''s scan'
);

insert into public.collections (id, name)
values ('00000000-0000-4000-e700-000000000001', 'Ukay jackets');
select collection_tests.check(
  (select user_id from public.collections where id = '00000000-0000-4000-e700-000000000001')
    = '00000000-0000-4000-e500-00000000000a',
  'a collection belongs to whoever made it'
);
insert into public.collection_items (collection_id, scan_id) values
  ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000001'),
  ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000002');
-- Adding what's already in it changes nothing, as the app's "put these in" does.
insert into public.collection_items (collection_id, scan_id)
values ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000001')
on conflict (collection_id, scan_id) do nothing;
select collection_tests.check(
  (select count(*) from public.collection_items) = 2,
  'an owner puts their scans in their collection, once each'
);
select collection_tests.check_rejected(
  $$insert into public.collection_items (collection_id, scan_id)
    values ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000003')$$,
  array['42501'],
  'nobody puts someone else''s scan in their collection'
);
select collection_tests.check_rejected(
  $$insert into public.collections (user_id, name)
    values ('00000000-0000-4000-e500-00000000000b', 'Planted')$$,
  array['42501'],
  'nobody makes a collection as someone else'
);
select collection_tests.check_rejected(
  $$insert into public.collections (name) values ('')$$,
  array['23514'],
  'a collection needs a name'
);
select collection_tests.check_rejected(
  $$insert into public.collections (name) values (repeat('x', 41))$$,
  array['23514'],
  'a collection''s name is 40 characters at most'
);
select collection_tests.check_rejected(
  $$insert into public.collections (name) values ('  Untidy ')$$,
  array['23514'],
  'a collection''s name is trimmed'
);
select collection_tests.check(
  collection_tests.changed($$update public.collections set name = 'Jackets'
    where id = '00000000-0000-4000-e700-000000000001'$$) = 1,
  'an owner renames their collection'
);
select collection_tests.check_rejected(
  $$update public.collections set created_at = now() - interval '1 year'
    where id = '00000000-0000-4000-e700-000000000001'$$,
  array['42501'],
  'only a collection''s name can change'
);
reset role;

-- 3. Vic sees none of it and changes none of it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e500-00000000000b', false);
select collection_tests.check(
  (select count(*) from public.collections) = 0,
  'someone else''s collections can''t be seen'
);
select collection_tests.check(
  (select count(*) from public.collection_items) = 0,
  'what''s in someone else''s collections can''t be seen'
);
select collection_tests.check(
  (select count(*) from public.scan_history where paid_php is not null) = 0,
  'what someone else paid can''t be seen'
);
select collection_tests.check(
  collection_tests.changed($$update public.collections set name = 'Mine now'
    where id = '00000000-0000-4000-e700-000000000001'$$) = 0,
  'nobody renames someone else''s collection'
);
select collection_tests.check(
  collection_tests.changed($$delete from public.collection_items
    where collection_id = '00000000-0000-4000-e700-000000000001'$$) = 0,
  'nobody empties someone else''s collection'
);
select collection_tests.check(
  collection_tests.changed($$delete from public.collections
    where id = '00000000-0000-4000-e700-000000000001'$$) = 0,
  'nobody deletes someone else''s collection'
);
select collection_tests.check_rejected(
  $$insert into public.collection_items (collection_id, scan_id)
    values ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000003')$$,
  array['42501'],
  'nobody puts their scan in someone else''s collection'
);
reset role;

-- 4. Uma takes a thing out, deletes a scan, then the collection; the scans stay.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e500-00000000000a', false);
select collection_tests.check(
  collection_tests.changed($$delete from public.collection_items
    where scan_id = '00000000-0000-4000-e600-000000000002'$$) = 1,
  'an owner takes a thing out of their collection'
);
insert into public.collection_items (collection_id, scan_id)
values ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-e600-000000000002');
delete from public.scan_history where id = '00000000-0000-4000-e600-000000000002';
select collection_tests.check(
  (select count(*) from public.collection_items) = 1,
  'a deleted scan leaves its collections'
);
select collection_tests.check(
  collection_tests.changed($$delete from public.collections
    where id = '00000000-0000-4000-e700-000000000001'$$) = 1,
  'an owner deletes their collection'
);
select collection_tests.check(
  (select count(*) from public.collection_items) = 0
    and (select count(*) from public.scan_history) = 1,
  'a deleted collection leaves its scans in History'
);
reset role;

-- 5. Flood limits: 30 new collections an hour, 100 in all, 300 things put in an hour.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e500-00000000000c', false);
insert into public.collections (name) select 'Set ' || n from generate_series(1, 30) n;
select collection_tests.check_rejected(
  $$insert into public.collections (name) values ('One too many')$$,
  array['P0001'],
  'a thirty-first collection within an hour is refused'
);
reset role;

-- Wes's older collections and scans, made over the past days.
update public.collections set created_at = now() - interval '2 days'
 where user_id = '00000000-0000-4000-e500-00000000000c';
insert into public.collections (user_id, name, created_at)
select '00000000-0000-4000-e500-00000000000c', 'Old set ' || n, now() - interval '2 days'
  from generate_series(1, 70) n;
insert into public.scan_history (user_id, item_name, amount_php, low_php, high_php, created_at)
select '00000000-0000-4000-e500-00000000000c', 'Thing ' || n, 100, 80, 120, now() - interval '2 days'
  from generate_series(1, 301) n;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e500-00000000000c', false);
select collection_tests.check_rejected(
  $$insert into public.collections (name) values ('One hundred and first')$$,
  array['P0001'],
  'a hundred-and-first collection is refused'
);
insert into public.collection_items (collection_id, scan_id)
select (select id from public.collections where name = 'Set 1'), s.id
  from public.scan_history s
 order by s.item_name
 limit 300;
select collection_tests.check_rejected(
  $$insert into public.collection_items (collection_id, scan_id)
    select (select id from public.collections where name = 'Set 1'), s.id
      from public.scan_history s
     where s.id not in (select scan_id from public.collection_items)
     limit 1$$,
  array['P0001'],
  'a three-hundred-and-first thing put in within an hour is refused'
);
reset role;

\echo 'All collection tests passed.'
