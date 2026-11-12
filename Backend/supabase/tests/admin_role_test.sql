-- Behaviour tests for the admin role: only the database owner grants it, and no client can read
-- or change who the admins are, whatever its sign-up metadata or email address says. Run with
-- Backend/scripts/test-db.sh (local Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema admin_role_tests;
grant usage on schema admin_role_tests to anon, authenticated, service_role;

create function admin_role_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function admin_role_tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema admin_role_tests to anon, authenticated, service_role;

-- Ada is granted the role. Bo pretends: an admin in his sign-up metadata, and a company address.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-4000-a100-00000000000a', 'ada@test', '{"handle":"ada_admin"}', '{}'),
  ('00000000-0000-4000-a100-00000000000b', 'bo@snapworth.com',
   '{"handle":"bo_pretend","role":"admin","is_admin":true}', '{"role":"admin"}');
insert into public.admins (user_id) values ('00000000-0000-4000-a100-00000000000a');

-- 1. Who is an admin comes from the table alone.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a100-00000000000a', false);
select admin_role_tests.check(public.is_admin(), 'someone in the admins table is an admin');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a100-00000000000b', false);
select admin_role_tests.check(
  not public.is_admin(),
  'metadata and a company email address do not make an admin'
);

-- 2. No client can read or change the list, even an admin.
select admin_role_tests.check_rejected(
  $$select count(*) from public.admins$$,
  array['42501'],
  'a signed-in person cannot read the admins table'
);
select admin_role_tests.check_rejected(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-a100-00000000000b')$$,
  array['42501'],
  'a signed-in person cannot make themselves an admin'
);
select admin_role_tests.check_rejected(
  $$update public.admins set granted_at = now()$$,
  array['42501'],
  'a signed-in person cannot change the admins table'
);
select admin_role_tests.check_rejected(
  $$delete from public.admins$$,
  array['42501'],
  'a signed-in person cannot delete from the admins table'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a100-00000000000a', false);
select admin_role_tests.check_rejected(
  $$select count(*) from public.admins$$,
  array['42501'],
  'an admin cannot read the admins table either: only the database owner can'
);
select admin_role_tests.check_rejected(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-a100-00000000000b')$$,
  array['42501'],
  'an admin cannot grant the role to someone else'
);
reset role;

-- 3. Signed out, there is no role to ask about.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select admin_role_tests.check_rejected(
  $$select public.is_admin()$$,
  array['42501'],
  'signed-out visitors cannot ask who is an admin'
);
select admin_role_tests.check_rejected(
  $$select count(*) from public.admins$$,
  array['42501'],
  'signed-out visitors cannot read the admins table'
);
select admin_role_tests.check_rejected(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-a100-00000000000b')$$,
  array['42501'],
  'signed-out visitors cannot grant the role'
);
reset role;

-- 4. Taking the role away is the database owner's too, and deleting an account takes it along.
delete from public.admins where user_id = '00000000-0000-4000-a100-00000000000a';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a100-00000000000a', false);
select admin_role_tests.check(not public.is_admin(), 'removing the row removes the role');
reset role;

insert into public.admins (user_id) values ('00000000-0000-4000-a100-00000000000a');
delete from auth.users where id = '00000000-0000-4000-a100-00000000000a';
select admin_role_tests.check(
  not exists (select 1 from public.admins where user_id = '00000000-0000-4000-a100-00000000000a'),
  'deleting an account deletes its admin row'
);

\echo 'All admin role tests passed.'
