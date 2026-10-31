-- Behaviour tests for hanap posts: who can post and see them, moderation, closing and deleting,
-- and the limits a client cannot get around. Run with Backend/scripts/test-db.sh (local
-- Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists hanap_tests;
grant usage on schema hanap_tests to anon, authenticated, service_role;

create function hanap_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function hanap_tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema hanap_tests to anon, authenticated, service_role;

-- Two buyers, Hana and Hugo.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-e000-00000000000a', 'hana@test', '{"handle":"hana"}'),
  ('00000000-0000-4000-e000-00000000000b', 'hugo@test', '{"handle":"hugo"}');

-- 1. Signed-out visitors can look but not post.
set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body) values ('Nike windbreaker')$$,
  array['42501'],
  'signed-out visitors cannot post a hanap'
);
reset role;

-- 2. Hana posts; it is pending, so only she sees it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e000-00000000000a', false);
insert into public.hanap_posts (body, max_php) values ('  Nike   windbreaker, size M  ', 1500);
-- A client can't choose a post's id, so the test gives this one a known id to refer to.
reset role;
update public.hanap_posts set id = '00000000-0000-4000-e100-000000000001'
 where body = 'Nike windbreaker, size M';
set role authenticated;
select hanap_tests.check(
  (select body from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001')
    = 'Nike windbreaker, size M',
  'a hanap is tidied as it is posted'
);
select hanap_tests.check(
  (select author_id from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001')
    = '00000000-0000-4000-e000-00000000000a',
  'a hanap belongs to whoever posted it'
);
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body, moderation_status)
    values ('Polaroid camera', 'approved')$$,
  array['42501'],
  'nobody can approve their own hanap'
);
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body, author_id)
    values ('Polaroid camera', '00000000-0000-4000-e000-00000000000b')$$,
  array['42501'],
  'nobody can post a hanap as someone else'
);
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body) values ('  a ')$$,
  array['23514'],
  'a hanap needs a few letters'
);
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body, max_php) values ('Walkman', 0)$$,
  array['23514'],
  'a budget is at least a peso'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-e000-00000000000b', false);
select hanap_tests.check(
  (select count(*) from public.hanap_posts) = 0,
  'a pending hanap is hidden from everyone else'
);
reset role;

-- 3. Moderation approves it; now everyone sees it.
update public.hanap_posts
   set moderation_status = 'approved', moderated_at = now()
 where id = '00000000-0000-4000-e100-000000000001';

set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select hanap_tests.check(
  (select count(*) from public.hanap_posts) = 1,
  'signed-out visitors see an approved, open hanap'
);
reset role;

-- 4. Only Hana can close or delete it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e000-00000000000b', false);
update public.hanap_posts set status = 'found'
 where id = '00000000-0000-4000-e100-000000000001';
select hanap_tests.check(
  (select status from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001')
    = 'open',
  'someone else cannot close a hanap'
);
delete from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001';
select hanap_tests.check(
  (select count(*) from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001') = 1,
  'someone else cannot delete a hanap'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-e000-00000000000a', false);
select hanap_tests.check_rejected(
  $$update public.hanap_posts set moderation_status = 'approved'
     where id = '00000000-0000-4000-e100-000000000001'$$,
  array['42501'],
  'an author cannot change moderation'
);
update public.hanap_posts set status = 'found'
 where id = '00000000-0000-4000-e100-000000000001';
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select hanap_tests.check(
  (select count(*) from public.hanap_posts) = 0,
  'a found hanap is no longer public'
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-e000-00000000000a', false);
select hanap_tests.check(
  (select count(*) from public.hanap_posts) = 1,
  'its author still sees a found hanap'
);
delete from public.hanap_posts where id = '00000000-0000-4000-e100-000000000001';
select hanap_tests.check(
  (select count(*) from public.hanap_posts) = 0,
  'an author can delete their hanap'
);

-- 5. Flood limit: five posts an hour.
insert into public.hanap_posts (body) select 'Polaroid ' || n from generate_series(1, 5) n;
select hanap_tests.check_rejected(
  $$insert into public.hanap_posts (body) values ('one too many')$$,
  array['P0001'],
  'a sixth hanap within an hour is refused'
);
reset role;

\echo 'All hanap tests passed.'
