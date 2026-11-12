-- Behaviour tests for a profile's public details (20261112000000_profile_details_backfill.sql):
-- the one-time backfill from account metadata, new accounts starting with their details, and who
-- can write them. Run with Backend/scripts/test-db.sh. Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists detail_tests;
grant usage on schema detail_tests to anon, authenticated, service_role;

create function detail_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function detail_tests.check_rejected(statement text, codes text[], description text)
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

-- Counts the rows an update changed, since row-level security skips others' rows silently.
create function detail_tests.updated(statement text) returns integer
language plpgsql as $$
declare
  changed integer;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on all functions in schema detail_tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. A new account starts with the details it signed up with, within the columns' limits.
-- ---------------------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-f100-0000000000a1', 'det-maya@test',
   '{"handle":"det_maya","full_name":"  Maya Cruz  ","bio":"Thrifts in Cebu","location":"Cebu City"}'),
  -- A name from Google arrives as `name`.
  ('00000000-0000-4000-f100-0000000000a2', 'det-gina@test', '{"handle":"det_gina","name":"Gina G"}'),
  -- Too long for the columns: cut, not refused.
  ('00000000-0000-4000-f100-0000000000a3', 'det-long@test',
   json_build_object('handle', 'det_long', 'full_name', repeat('n', 100), 'bio', repeat('b', 400),
                     'location', repeat('l', 120))::jsonb),
  -- Not strings, or empty: ignored.
  ('00000000-0000-4000-f100-0000000000a4', 'det-odd@test',
   '{"handle":"det_odd","full_name":42,"bio":{"a":1},"location":"   "}'),
  ('00000000-0000-4000-f100-0000000000a5', 'det-none@test', '{"handle":"det_none"}'),
  -- (No handle in its metadata, so it gets one derived from its id; this id makes that one unique.)
  ('00000f10-0000-4000-f100-0000000000a6', 'det-null@test', null);

select detail_tests.check(
  (select display_name = 'Maya Cruz' and bio = 'Thrifts in Cebu' and location = 'Cebu City'
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a1'),
  'a new account starts with the name, bio and place it signed up with, trimmed'
);
select detail_tests.check(
  (select display_name = 'Gina G' from public.profiles
    where id = '00000000-0000-4000-f100-0000000000a2'),
  'a name given as `name` (Google) is used when there is no full_name'
);
select detail_tests.check(
  (select char_length(display_name) = 60 and char_length(bio) = 280 and char_length(location) = 80
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a3'),
  'values longer than the columns allow are cut, and the account is still created'
);
select detail_tests.check(
  (select display_name = '' and bio = '' and location = '' from public.profiles
    where id = '00000000-0000-4000-f100-0000000000a4'),
  'metadata that is not a non-empty string is ignored'
);
select detail_tests.check(
  (select count(*) = 2 and bool_and(display_name = '' and bio = '' and location = '')
     from public.profiles
    where id in ('00000000-0000-4000-f100-0000000000a5', '00000f10-0000-4000-f100-0000000000a6')),
  'an account with no metadata, or null metadata, still gets a profile with empty details'
);

-- ---------------------------------------------------------------------------------------------
-- 2. The backfill: accounts whose profile rows predate the details. Their metadata is what the
--    old Edit profile screen saved. Running the migration again stands in for the deploy.
-- ---------------------------------------------------------------------------------------------

-- Put the profiles back as they were before the app wrote details here: empty, except Maya's bio,
-- which she has since written herself and which must be kept.
update public.profiles set display_name = '', bio = '', location = ''
 where id in (
   '00000000-0000-4000-f100-0000000000a1', '00000000-0000-4000-f100-0000000000a2',
   '00000000-0000-4000-f100-0000000000a3', '00000000-0000-4000-f100-0000000000a4'
 );
update public.profiles set bio = 'Written on the profile itself'
 where id = '00000000-0000-4000-f100-0000000000a1';

\ir ../migrations/20261112000000_profile_details_backfill.sql

select detail_tests.check(
  (select display_name = 'Maya Cruz' and location = 'Cebu City'
          and bio = 'Written on the profile itself'
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a1'),
  'the backfill fills empty columns from metadata and keeps what the profile already has'
);
select detail_tests.check(
  (select display_name = 'Gina G' and bio = '' and location = ''
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a2'),
  'the backfill uses `name` when there is no full_name, and leaves the rest empty'
);
select detail_tests.check(
  (select char_length(display_name) = 60 and char_length(bio) = 280 and char_length(location) = 80
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a3'),
  'the backfill cuts long values to the columns'' limits instead of failing'
);
select detail_tests.check(
  (select display_name = '' and bio = '' and location = '' from public.profiles
    where id = '00000000-0000-4000-f100-0000000000a4'),
  'the backfill ignores metadata that is not a non-empty string'
);

-- Running it again changes nothing.
create temp table detail_before as
  select id, display_name, bio, location from public.profiles;
\ir ../migrations/20261112000000_profile_details_backfill.sql
select detail_tests.check(
  not exists (
    select 1 from detail_before b join public.profiles p using (id)
     where (b.display_name, b.bio, b.location) is distinct from (p.display_name, p.bio, p.location)
  ),
  'running the backfill again changes nothing'
);

-- ---------------------------------------------------------------------------------------------
-- 3. Who can write them: the owner, and nobody else; and everyone can read them.
-- ---------------------------------------------------------------------------------------------

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-f100-0000000000a1', false);

select detail_tests.check(
  detail_tests.updated($$update public.profiles
    set display_name = 'Maya C.', bio = 'New bio', location = 'Mandaue'
    where id = '00000000-0000-4000-f100-0000000000a1'$$) = 1,
  'a person can change their own name, bio and place'
);
select detail_tests.check(
  detail_tests.updated($$update public.profiles
    set display_name = 'Not Gina', bio = 'Hacked', location = 'Nowhere'
    where id = '00000000-0000-4000-f100-0000000000a2'$$) = 0,
  'nobody can change someone else''s name, bio or place'
);
select detail_tests.check_rejected(
  $$update public.profiles set bio = repeat('x', 281)
    where id = '00000000-0000-4000-f100-0000000000a1'$$,
  array['23514'],
  'a bio longer than the column allows is refused'
);
select detail_tests.check_rejected(
  $$update public.profiles set display_name = repeat('x', 61)
    where id = '00000000-0000-4000-f100-0000000000a1'$$,
  array['23514'],
  'a name longer than the column allows is refused'
);
select detail_tests.check_rejected(
  $$update public.profiles set location = repeat('x', 81)
    where id = '00000000-0000-4000-f100-0000000000a1'$$,
  array['23514'],
  'a place longer than the column allows is refused'
);
select detail_tests.check_rejected(
  $$update public.profiles set created_at = now() - interval '5 years'
    where id = '00000000-0000-4000-f100-0000000000a1'$$,
  array['42501'],
  'the joined date is not theirs to change'
);
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select detail_tests.check(
  (select display_name = 'Maya C.' and bio = 'New bio' and location = 'Mandaue'
     from public.profiles where id = '00000000-0000-4000-f100-0000000000a1'),
  'anyone, signed out too, can read a seller''s name, bio and place'
);
select detail_tests.check_rejected(
  $$update public.profiles set bio = 'anon was here'
    where id = '00000000-0000-4000-f100-0000000000a1'$$,
  array['42501'],
  'a signed-out visitor can''t write any profile details'
);
reset role;

\echo 'All profile detail tests passed.'
