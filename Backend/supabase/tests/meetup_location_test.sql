-- Behaviour tests for live location at an agreed meetup (20261119000000_meetup_live_location.sql):
-- only an agreed meetup can be shared for, only the other person sees it, only while it's fresh,
-- never across a block, and stopping removes it. Run with Backend/scripts/test-db.sh.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists here_tests;
grant usage on schema here_tests to anon, authenticated, service_role;

create function here_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function here_tests.check_rejected(statement text, codes text[], description text)
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

create function here_tests.sign_in(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), false);
  perform set_config(
    'request.jwt.claims',
    case when who is null then '{"role":"anon"}'
         else json_build_object('sub', who, 'iss', 'https://snapworth.supabase.co/auth/v1')::text
    end,
    false
  );
end;
$$;

grant execute on all functions in schema here_tests to anon, authenticated, service_role;

-- Ana sells a bike to Ben; they agreed to meet at the mall, and a second meetup is still only
-- proposed. Cat has nothing to do with it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a400-00000000000a', 'ana-here@test', '{"handle":"ana_here"}'),
  ('00000000-0000-4000-a400-00000000000b', 'ben-here@test', '{"handle":"ben_here"}'),
  ('00000000-0000-4000-a400-00000000000c', 'cat-here@test', '{"handle":"cat_here"}');

insert into public.listings (id, slug, seller_id, title, asking_php, moderation_status) values
  ('00000000-0000-4000-a410-00000000000a', 'here-bike', '00000000-0000-4000-a400-00000000000a',
   'Folding bike', 6500, 'approved');

insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('00000000-0000-4000-a420-000000000001', '00000000-0000-4000-a410-00000000000a',
   '00000000-0000-4000-a400-00000000000b', '00000000-0000-4000-a400-00000000000a');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-a420-000000000001', '00000000-0000-4000-a400-00000000000a'),
  ('00000000-0000-4000-a420-000000000001', '00000000-0000-4000-a400-00000000000b');

insert into public.messages (id, conversation_id, sender_id, kind, body, meetup_place, meetup_when) values
  ('00000000-0000-4000-a430-000000000001', '00000000-0000-4000-a420-000000000001',
   '00000000-0000-4000-a400-00000000000b', 'meetup', '', 'SM Seaside', 'Sat, Nov 21, 2:00 PM'),
  ('00000000-0000-4000-a430-000000000002', '00000000-0000-4000-a420-000000000001',
   '00000000-0000-4000-a400-00000000000b', 'meetup', '', 'Ayala Center', 'Sun, Nov 22, 10:00 AM'),
  ('00000000-0000-4000-a430-000000000003', '00000000-0000-4000-a420-000000000001',
   '00000000-0000-4000-a400-00000000000b', 'text', 'See you there', null, null);
update public.messages set meetup_status = 'confirmed'
 where id = '00000000-0000-4000-a430-000000000001';

set role authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. Only an agreed meetup, and only by the two people in it.
-- ---------------------------------------------------------------------------------------------

select here_tests.sign_in('00000000-0000-4000-a400-00000000000b');
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000002', 10.28, 123.88)$$,
  array['22023'],
  'a meetup that is only proposed cannot be shared for'
);
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000003', 10.28, 123.88)$$,
  array['P0002'],
  'a message that is not a meetup cannot be shared for'
);
select here_tests.check_rejected(
  $$insert into public.meetup_locations (meetup_id, user_id, conversation_id, lat, lng)
    values ('00000000-0000-4000-a430-000000000001', '00000000-0000-4000-a400-00000000000b',
            '00000000-0000-4000-a420-000000000001', 10.28, 123.88)$$,
  array['42501'],
  'nobody writes a location directly, only through the function'
);
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 95, 123.88)$$,
  array['23514'],
  'a position that is not on Earth is refused'
);

select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.2810, 123.8810, 12);
select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.2820, 123.8820, 8);
select here_tests.check(
  (select count(*) = 1 and bool_and(lat = 10.2820 and lng = 123.8820 and accuracy_m = 8)
     from public.meetup_locations where meetup_id = '00000000-0000-4000-a430-000000000001'),
  'Ben shares, then moves: one row, at his latest position'
);

select here_tests.sign_in('00000000-0000-4000-a400-00000000000c');
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.28, 123.88)$$,
  array['P0002'],
  'Cat cannot share for a meetup that is not hers'
);
select here_tests.check(
  not exists (select 1 from public.meetup_locations),
  'Cat sees nobody''s location'
);

-- ---------------------------------------------------------------------------------------------
-- 2. The other person sees it while it is fresh.
-- ---------------------------------------------------------------------------------------------

select here_tests.sign_in('00000000-0000-4000-a400-00000000000a');
select here_tests.check(
  (select count(*) = 1 and bool_and(user_id = '00000000-0000-4000-a400-00000000000b')
     from public.meetup_locations where meetup_id = '00000000-0000-4000-a430-000000000001'),
  'Ana sees where Ben is'
);
select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.2830, 123.8790);

reset role;
update public.meetup_locations set updated_at = now() - interval '20 minutes'
 where user_id = '00000000-0000-4000-a400-00000000000b';
set role authenticated;

select here_tests.sign_in('00000000-0000-4000-a400-00000000000a');
select here_tests.check(
  not exists (select 1 from public.meetup_locations
               where user_id = '00000000-0000-4000-a400-00000000000b'),
  'a position older than 15 minutes is never shown'
);

-- ---------------------------------------------------------------------------------------------
-- 3. A block ends it both ways.
-- ---------------------------------------------------------------------------------------------

reset role;
insert into public.user_blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-a400-00000000000b', '00000000-0000-4000-a400-00000000000a');
set role authenticated;

select here_tests.sign_in('00000000-0000-4000-a400-00000000000b');
select here_tests.check(
  not exists (select 1 from public.meetup_locations
               where user_id = '00000000-0000-4000-a400-00000000000a'),
  'once Ben blocks Ana, he no longer sees where she is'
);
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.28, 123.88)$$,
  array['SWBLK'],
  'and neither can share with the other'
);

reset role;
delete from public.user_blocks where blocker_id = '00000000-0000-4000-a400-00000000000b';
set role authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Stopping removes it; strangers never see anything.
-- ---------------------------------------------------------------------------------------------

select here_tests.sign_in('00000000-0000-4000-a400-00000000000a');
select public.stop_sharing_meetup_location('00000000-0000-4000-a430-000000000001');
select public.stop_sharing_meetup_location('00000000-0000-4000-a430-000000000001');
reset role;
select here_tests.check(
  not exists (select 1 from public.meetup_locations
               where user_id = '00000000-0000-4000-a400-00000000000a'),
  'Ana stops sharing (twice, harmlessly): her position is gone'
);

set role anon;
select here_tests.sign_in(null);
select here_tests.check_rejected(
  $$select 1 from public.meetup_locations$$,
  array['42501'],
  'someone signed out cannot read locations at all'
);
select here_tests.check_rejected(
  $$select public.share_meetup_location('00000000-0000-4000-a430-000000000001', 10.28, 123.88)$$,
  array['42501'],
  'or share one'
);
reset role;

\echo 'All meetup live-location tests passed.'
