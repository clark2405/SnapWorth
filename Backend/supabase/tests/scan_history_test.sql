-- Behaviour tests for scan history: scans are private to their owner, and the limits a client
-- cannot get around. Run with Backend/scripts/test-db.sh (local Postgres + auth stub). Each check
-- raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists scan_tests;
grant usage on schema scan_tests to anon, authenticated, service_role;

create function scan_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function scan_tests.check_rejected(statement text, codes text[], description text)
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

-- Counts the rows an update or delete changed, since row-level security skips others' silently.
create function scan_tests.changed(statement text) returns integer
language plpgsql as $$
declare
  rows integer;
begin
  execute statement;
  get diagnostics rows = row_count;
  return rows;
end;
$$;

grant execute on all functions in schema scan_tests to anon, authenticated, service_role;

-- Sam and Tess each snap things.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-c500-00000000000a', 'sam-scans@test', '{"handle":"sam_scans"}'),
  ('00000000-0000-4000-c500-00000000000b', 'tess-scans@test', '{"handle":"tess_scans"}');

-- 1. Signed out, there's nothing to see and nothing can be saved.
set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select scan_tests.check_rejected(
  $$insert into public.scan_history (item_name, amount_php, low_php, high_php)
    values ('Rolex Submariner', 450000, 400000, 500000)$$,
  array['42501'],
  'a signed-out visitor cannot save a scan'
);
select scan_tests.check_rejected(
  $$select count(*) from public.scan_history$$,
  array['42501'],
  'a signed-out visitor cannot read scans'
);
reset role;

-- 2. Sam saves scans; each is his, whatever the app sends.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-c500-00000000000a', false);
insert into public.scan_history (id, item_name, amount_php, low_php, high_php, assumptions)
values ('00000000-0000-4000-c600-000000000001', 'Walkman', 1900, 1600, 2200, '["Tested"]');
select scan_tests.check(
  (select user_id from public.scan_history where id = '00000000-0000-4000-c600-000000000001')
    = '00000000-0000-4000-c500-00000000000a',
  'a scan belongs to whoever saved it'
);
select scan_tests.check_rejected(
  $$insert into public.scan_history (user_id, item_name, amount_php, low_php, high_php)
    values ('00000000-0000-4000-c500-00000000000b', 'Planted', 100, 50, 150)$$,
  array['42501'],
  'nobody can save a scan as someone else'
);
select scan_tests.check_rejected(
  $$insert into public.scan_history (id, item_name, amount_php, low_php, high_php)
    values ('scan-1730900000000-ab3x9', 'Walkman', 1900, 1600, 2200)$$,
  array['22P02'],
  'an id that isn''t a UUID is refused'
);
select scan_tests.check_rejected(
  $$insert into public.scan_history (item_name, amount_php, low_php, high_php)
    values ('Backwards range', 1000, 1200, 800)$$,
  array['23514'],
  'a range whose top is under its bottom is refused'
);
select scan_tests.check_rejected(
  $$insert into public.scan_history (item_name, amount_php, low_php, high_php, assumptions)
    values ('Odd assumptions', 1000, 800, 1200, '{"not":"a list"}')$$,
  array['23514'],
  'assumptions must be a list'
);
reset role;

-- 3. Tess sees, changes and deletes only her own.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-c500-00000000000b', false);
insert into public.scan_history (item_name, amount_php, low_php, high_php)
values ('Film camera', 3500, 3000, 4000);
select scan_tests.check(
  (select count(*) from public.scan_history) = 1,
  'someone sees only their own scans'
);
select scan_tests.check(
  scan_tests.changed($$update public.scan_history set status = 'listed'
    where id = '00000000-0000-4000-c600-000000000001'$$) = 0,
  'nobody can change someone else''s scan'
);
select scan_tests.check(
  scan_tests.changed($$delete from public.scan_history
    where id = '00000000-0000-4000-c600-000000000001'$$) = 0,
  'nobody can delete someone else''s scan'
);
select scan_tests.check(
  scan_tests.changed($$update public.scan_history set status = 'listed'
    where item_name = 'Film camera'$$) = 1,
  'an owner can change a scan''s status'
);
select scan_tests.check_rejected(
  $$update public.scan_history set amount_php = 999999 where item_name = 'Film camera'$$,
  array['42501'],
  'a saved estimate can''t be rewritten'
);
select scan_tests.check(
  scan_tests.changed($$delete from public.scan_history where item_name = 'Film camera'$$) = 1,
  'an owner can delete their scan'
);
reset role;

-- 4. Flood limit: sixty saved scans an hour.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-c500-00000000000b', false);
insert into public.scan_history (item_name, amount_php, low_php, high_php)
select 'Snap ' || n, 1000, 800, 1200 from generate_series(1, 60) n;
select scan_tests.check_rejected(
  $$insert into public.scan_history (item_name, amount_php, low_php, high_php)
    values ('One too many', 1000, 800, 1200)$$,
  array['P0001'],
  'a sixty-first scan within an hour is refused'
);
reset role;

\echo 'All scan history tests passed.'
