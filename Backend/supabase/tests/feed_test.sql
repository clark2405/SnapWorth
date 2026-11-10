-- Behaviour tests for the Feed and Votes migration (20261110000300_feed_and_votes.sql).
-- Run with Backend/scripts/test-db.sh.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists feed_tests;

create function feed_tests.sign_in(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), false);
  perform set_config(
    'request.jwt.claims',
    case when who is null then ''
         else json_build_object('sub', who, 'iss', 'https://snapworth.supabase.co/auth/v1')::text
    end,
    false
  );
end;
$$;

create function feed_tests.sign_out() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
end;
$$;

create function feed_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function feed_tests.check_raises(
  sql text,
  expected_code text,
  description text
) returns void
language plpgsql as $$
begin
  begin
    execute sql;
  exception
    when others then
      if sqlstate = expected_code then
        raise notice 'ok - %', description;
        return;
      end if;
      raise exception 'FAIL: % (raised % "%" instead of %)',
        description, sqlstate, sqlerrm, expected_code;
  end;
  raise exception 'FAIL: % (did not raise)', description;
end;
$$;

grant usage on schema feed_tests to anon, authenticated;
grant execute on all functions in schema feed_tests to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-fd00-00000000000a', 'author_a@test', '{"handle":"feed_author_a"}'),
  ('00000000-0000-4000-fd00-00000000000b', 'voter_b@test', '{"handle":"feed_voter_b"}'),
  ('00000000-0000-4000-fd00-00000000000c', 'voter_c@test', '{"handle":"feed_voter_c"}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 1. Author A saves a scan and publishes a feed post for it
-- ---------------------------------------------------------------------------------------------

set role authenticated;
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000a');

insert into public.scan_history (
  id, item_name, amount_php, low_php, high_php, paid_php
) values (
  '00000000-0000-4000-fe00-000000000001',
  'Vintage Seiko 5 Automatic',
  3200,
  2800,
  3600,
  450
);

insert into storage.objects (bucket_id, name) values (
  'scan-photos',
  '00000000-0000-4000-fd00-00000000000a/00000000-0000-4000-fe00-000000000001.jpg'
);

insert into public.feed_posts (
  id, title, category, body, estimate_php, scan_id, photo_path
) values (
  '00000000-0000-4000-ff00-000000000001',
  '  Vintage Seiko 5 Automatic  ',
  'collectibles',
  '  Picked up this Seiko 5 for a steal. Is ₱3,200 fair?  ',
  3200,
  '00000000-0000-4000-fe00-000000000001',
  '00000000-0000-4000-fd00-00000000000a/00000000-0000-4000-fe00-000000000001.jpg'
);

select feed_tests.check(
  (select title = 'Vintage Seiko 5 Automatic'
      and body = 'Picked up this Seiko 5 for a steal. Is ₱3,200 fair?'
      and slug like 'vintage-seiko-5-automatic-%'
      and moderation_status = 'pending'
     from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000001'),
  'publishing a feed post trims title/body, auto-generates a slug, and starts pending moderation'
);

-- While pending, Voter B and anon cannot see the post or its scan photo
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
select feed_tests.check(
  not exists (
    select 1 from public.feed_posts where id = '00000000-0000-4000-ff00-000000000001'
  ),
  'another user cannot see a pending feed post'
);
select feed_tests.check(
  not exists (
    select 1
      from storage.objects
     where bucket_id = 'scan-photos'
       and name = '00000000-0000-4000-fd00-00000000000a/00000000-0000-4000-fe00-000000000001.jpg'
  ),
  'another user cannot read the scan photo of a pending feed post'
);

-- Voter B cannot link Author A's scan or spoof photo_path
select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body, estimate_php, scan_id)
    values ('Stolen Scan', 'Is this fair?', 1000, '00000000-0000-4000-fe00-000000000001')$$,
  '23514',
  'a user cannot attach someone else''s scan to their feed post'
);

-- Client cannot bypass moderation on insert
select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body, estimate_php, moderation_status)
    values ('Bypass', 'Is this fair?', 1000, 'approved')$$,
  '42501',
  'clients cannot set moderation_status on feed_posts insert'
);

-- ---------------------------------------------------------------------------------------------
-- 2. Service role approves the post; scan photo becomes public and comments work by slug or UUID
-- ---------------------------------------------------------------------------------------------

reset role;
update public.feed_posts
   set moderation_status = 'approved',
       moderation_ref = 'test-approved',
       moderated_at = now()
 where id = '00000000-0000-4000-ff00-000000000001';

set role anon;
select feed_tests.sign_out();
select feed_tests.check(
  exists (
    select 1
      from storage.objects
     where bucket_id = 'scan-photos'
       and name = '00000000-0000-4000-fd00-00000000000a/00000000-0000-4000-fe00-000000000001.jpg'
  ),
  'guests can read the scan photo once the feed post is approved'
);

-- ---------------------------------------------------------------------------------------------
-- 3. Reposting a listing and voting syncs both `feed_posts` tallies and `listings` verdict
-- ---------------------------------------------------------------------------------------------

set role authenticated;
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000a');

insert into public.listings (
  id, title, asking_php, category, condition, area, estimate_php, estimate_low_php, estimate_high_php
) values (
  '00000000-0000-4000-fe00-000000000002',
  'Vintage Seiko 5 Automatic',
  3500,
  'collectibles',
  'good',
  'cebu-city',
  3200,
  2800,
  3600
);

insert into public.feed_posts (
  id, title, category, body, estimate_php, listing_id
) values (
  '00000000-0000-4000-ff00-000000000002',
  'Vintage Seiko 5 Automatic',
  'collectibles',
  'I''m asking ₱3,500 for this Seiko 5. Fair price?',
  3200,
  '00000000-0000-4000-fe00-000000000002'
);

reset role;
update public.feed_posts
   set moderation_status = 'approved',
       moderation_ref = 'test-approved',
       moderated_at = now()
 where id = '00000000-0000-4000-ff00-000000000002';

-- Voter B votes 'too_high'
set role authenticated;
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
insert into public.votes (post_id, choice) values
  ('00000000-0000-4000-ff00-000000000002', 'too_high');

select feed_tests.check(
  (select too_high_count = 1 and just_right_count = 0 and too_low_count = 0
     from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000002'),
  'casting a vote increments the post tally'
);

select feed_tests.check(
  (select verdict = 'too_high' and verdict_share = 100
     from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'voting on a reposted listing updates the listing verdict and share'
);

-- Voter C cannot see or change Voter B's vote row, and casts 'just_right'
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000c');
select feed_tests.check(
  (select count(*) = 0 from public.votes),
  'a voter cannot read another user''s votes'
);

insert into public.votes (post_id, choice) values
  ('00000000-0000-4000-ff00-000000000002', 'just_right');

-- Voter B changes their mind from 'too_high' to 'just_right'
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
update public.votes
   set choice = 'just_right'
 where post_id = '00000000-0000-4000-ff00-000000000002';

select feed_tests.check(
  (select too_high_count = 0 and just_right_count = 2 and too_low_count = 0
     from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000002'),
  'changing a vote moves the count from the old choice to the new choice'
);

select feed_tests.check(
  (select verdict = 'just_right' and verdict_share = 100
     from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'changing a vote updates the linked listing verdict to just_right'
);

-- Voter B withdraws their vote
delete from public.votes where post_id = '00000000-0000-4000-ff00-000000000002';

select feed_tests.check(
  (select too_high_count = 0 and just_right_count = 1 and too_low_count = 0
     from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000002'),
  'withdrawing a vote decrements the post tally'
);

-- ---------------------------------------------------------------------------------------------
-- 4. Flood limit on feed_posts (at most 10 posts in an hour)
-- ---------------------------------------------------------------------------------------------

select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000a');
do $$
begin
  -- Author A already has 2 posts in the last hour; insert 8 more to reach 10.
  for i in 3..10 loop
    insert into public.feed_posts (title, body, estimate_php)
    values ('Item ' || i, 'Is item ' || i || ' priced fairly?', 1000 + i);
  end loop;
end;
$$;

select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body, estimate_php)
    values ('Item 11', 'Too many posts in an hour', 2000)$$,
  'P0001',
  'flood limit stops a user from publishing more than 10 feed posts in an hour'
);

-- Author A deletes their posts, which makes their scan photo private again
delete from public.feed_posts where owner_id = '00000000-0000-4000-fd00-00000000000a';

set role anon;
select feed_tests.sign_out();
select feed_tests.check(
  not exists (
    select 1
      from storage.objects
     where bucket_id = 'scan-photos'
       and name = '00000000-0000-4000-fd00-00000000000a/00000000-0000-4000-fe00-000000000001.jpg'
  ),
  'deleting a feed post makes its scan photo private again'
);

reset role;
drop schema feed_tests cascade;

