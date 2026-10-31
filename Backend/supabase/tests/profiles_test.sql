-- Behaviour tests for profiles: people change their own handle and nothing else. Run with
-- Backend/scripts/test-db.sh (local Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists profile_tests;
grant usage on schema profile_tests to anon, authenticated, service_role;

create function profile_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function profile_tests.check_rejected(statement text, codes text[], description text)
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
create function profile_tests.updated(statement text) returns integer
language plpgsql as $$
declare
  changed integer;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on all functions in schema profile_tests to anon, authenticated, service_role;

-- Pia and Quin each have a profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-f000-0000000000a1', 'pia@test', '{"handle":"pia_sells"}'),
  ('00000000-0000-4000-f000-0000000000a2', 'quin@test', '{"handle":"quin_buys"}');

-- 1. Pia changes her own handle.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-f000-0000000000a1', false);

select profile_tests.check(
  profile_tests.updated($$update public.profiles set handle = 'pia_thrifts'
    where id = '00000000-0000-4000-f000-0000000000a1'$$) = 1,
  'a person can change their own handle'
);
select profile_tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-f000-0000000000a1')
    = 'pia_thrifts',
  'the new handle is what everyone reads'
);

-- 2. The handle's rules still hold.
select profile_tests.check_rejected(
  $$update public.profiles set handle = 'quin_buys'
    where id = '00000000-0000-4000-f000-0000000000a1'$$,
  array['23505'],
  'a handle someone else has is refused'
);
select profile_tests.check_rejected(
  $$update public.profiles set handle = 'Pia Thrifts!'
    where id = '00000000-0000-4000-f000-0000000000a1'$$,
  array['23514'],
  'a handle with capitals, spaces or symbols is refused'
);

-- 3. Only the handle, and only your own.
select profile_tests.check(
  profile_tests.updated($$update public.profiles set handle = 'quin_hacked'
    where id = '00000000-0000-4000-f000-0000000000a2'$$) = 0,
  'someone else''s handle can''t be changed'
);
select profile_tests.check_rejected(
  $$update public.profiles set avatar_url = 'https://example.com/me.png'
    where id = '00000000-0000-4000-f000-0000000000a1'$$,
  array['42501'],
  'the photo can''t be set from the app yet'
);
select profile_tests.check_rejected(
  $$update public.profiles set id = '00000000-0000-4000-f000-0000000000ff'
    where id = '00000000-0000-4000-f000-0000000000a1'$$,
  array['42501'],
  'a profile can''t be moved to another account'
);
reset role;

-- 4. Signed out, nothing changes.
set role anon;
select profile_tests.check_rejected(
  $$update public.profiles set handle = 'anon_was_here'
    where id = '00000000-0000-4000-f000-0000000000a1'$$,
  array['42501'],
  'a signed-out visitor can''t change any handle'
);
reset role;

select profile_tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-f000-0000000000a2')
    = 'quin_buys',
  'Quin''s handle is untouched'
);

\echo 'All profile tests passed.'
