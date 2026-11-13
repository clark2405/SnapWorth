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

create function feed_tests.changed(statement text) returns integer
language plpgsql as $$
declare
  rows integer;
begin
  execute statement;
  get diagnostics rows = row_count;
  return rows;
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
  id, title, category, body, scan_id, photo_path
) values (
  '00000000-0000-4000-ff00-000000000001',
  '  Vintage Seiko 5 Automatic  ',
  'collectibles',
  '  Picked up this Seiko 5 for a steal. Is ₱3,200 fair?  ',
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

select feed_tests.check(
  (select estimate_php from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000001') = 3200,
  'a post about a scan takes its estimate from the scan'
);
select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body, estimate_php)
    values ('Forged estimate', 'Is this fair?', 99999)$$,
  '42501',
  'a client cannot write the estimate on a feed post'
);
select feed_tests.check_raises(
  $$update public.feed_posts set estimate_php = 1
     where id = '00000000-0000-4000-ff00-000000000001'$$,
  '42501',
  'a client cannot change the estimate on a feed post'
);
insert into public.feed_posts (id, title, body)
values ('00000000-0000-4000-ff00-000000000003', 'Mystery box', 'What would this be worth?');
select feed_tests.check(
  (select estimate_php is null from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000003'),
  'a post with no scan or listing has no estimate'
);
delete from public.feed_posts where id = '00000000-0000-4000-ff00-000000000003';

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
  $$insert into public.feed_posts (title, body, scan_id)
    values ('Stolen Scan', 'Is this fair?', '00000000-0000-4000-fe00-000000000001')$$,
  '23514',
  'a user cannot attach someone else''s scan to their feed post'
);

-- Client cannot bypass moderation on insert
select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body, moderation_status)
    values ('Bypass', 'Is this fair?', 'approved')$$,
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
  id, scan_id, title, asking_php, category, condition, area
) values (
  '00000000-0000-4000-fe00-000000000002',
  '00000000-0000-4000-fe00-000000000001',
  'Vintage Seiko 5 Automatic',
  3500,
  'collectibles',
  'good',
  'cebu-city'
);

insert into public.feed_posts (
  id, title, category, body, listing_id
) values (
  '00000000-0000-4000-ff00-000000000002',
  'Vintage Seiko 5 Automatic',
  'collectibles',
  'I''m asking ₱3,500 for this Seiko 5. Fair price?',
  '00000000-0000-4000-fe00-000000000002'
);

select feed_tests.check(
  (select estimate_php = 3200 from public.feed_posts
    where id = '00000000-0000-4000-ff00-000000000002'),
  'a post that reposts a listing takes the listing''s estimate'
);

reset role;
update public.feed_posts
   set moderation_status = 'approved',
       moderation_ref = 'test-approved',
       moderated_at = now()
 where id = '00000000-0000-4000-ff00-000000000002';
update public.listings
   set moderation_status = 'approved',
       moderation_ref = 'test-approved',
       moderated_at = now()
 where id = '00000000-0000-4000-fe00-000000000002';

set role authenticated;
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000a');
select feed_tests.check(
  (select verdict is null and verdict_share is null
     from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'a new listing has no community verdict until someone votes'
);
select feed_tests.check_raises(
  $$insert into public.listings (title, asking_php, verdict, verdict_share)
    values ('Rigged', 1000, 'just_right', 99)$$,
  '42501',
  'a seller cannot write a community verdict when listing'
);
select feed_tests.check_raises(
  $$update public.listings set verdict = 'just_right', verdict_share = 99
     where id = '00000000-0000-4000-fe00-000000000002'$$,
  '42501',
  'a seller cannot write a community verdict afterwards'
);
select feed_tests.check_raises(
  $$insert into public.votes (post_id, choice)
    values ('00000000-0000-4000-ff00-000000000002', 'just_right')$$,
  '42501',
  'a post author cannot vote on their own feed post'
);

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

-- Voter C withdraws the last vote: the listing goes back to having no verdict
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000c');
delete from public.votes where post_id = '00000000-0000-4000-ff00-000000000002';
select feed_tests.check(
  (select verdict is null and verdict_share is null
     from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'when the votes are withdrawn the listing has no verdict again'
);

-- Votes on a post that moderation holds don't speak for the listing
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
insert into public.votes (post_id, choice)
values ('00000000-0000-4000-ff00-000000000002', 'too_low');
select feed_tests.check(
  (select verdict = 'too_low' and verdict_share = 100
     from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'an approved post''s votes set the listing verdict'
);
reset role;
update public.feed_posts set moderation_status = 'held'
 where id = '00000000-0000-4000-ff00-000000000002';
select feed_tests.check(
  (select verdict is null from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'holding the post takes its votes out of the listing verdict'
);
update public.feed_posts set moderation_status = 'approved'
 where id = '00000000-0000-4000-ff00-000000000002';
select feed_tests.check(
  (select verdict = 'too_low' from public.listings
    where id = '00000000-0000-4000-fe00-000000000002'),
  'approving the post brings its votes back'
);
set role authenticated;
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
delete from public.votes where post_id = '00000000-0000-4000-ff00-000000000002';

-- The statements the app sends to vote: an update, then an insert when nothing changed, and
-- never `user_id`. A PostgREST upsert is refused (even for a first vote), because ON CONFLICT DO
-- UPDATE needs UPDATE privilege on every column it sends, and the grants (insert: post_id,
-- choice; update: choice) don't let anyone rewrite `post_id` or `user_id`. Keep those grants.
select feed_tests.check_raises(
  $$insert into public.votes (post_id, user_id, choice)
    values ('00000000-0000-4000-ff00-000000000002', '00000000-0000-4000-fd00-00000000000b', 'too_high')
    on conflict (post_id, user_id) do update set
      post_id = excluded.post_id, user_id = excluded.user_id, choice = excluded.choice$$,
  '42501',
  'the old upsert shape is refused, even for a first vote'
);
select feed_tests.check(
  feed_tests.changed($$update public.votes set choice = 'too_high'
    where post_id = '00000000-0000-4000-ff00-000000000002'$$) = 0,
  'the app first updates: no row changes when the person has not voted yet'
);
select feed_tests.check(
  feed_tests.changed($$insert into public.votes (post_id, choice)
    values ('00000000-0000-4000-ff00-000000000002', 'too_high')$$) = 1,
  'then it inserts the vote, with no user_id'
);
select feed_tests.check(
  (select user_id = '00000000-0000-4000-fd00-00000000000b'
     from public.votes where post_id = '00000000-0000-4000-ff00-000000000002'),
  'the vote belongs to the caller by default'
);
select feed_tests.check(
  feed_tests.changed($$update public.votes set choice = 'too_low'
    where post_id = '00000000-0000-4000-ff00-000000000002'$$) = 1,
  'voting again updates the same vote in place'
);
select feed_tests.check(
  (select too_low_count = 1 and too_high_count = 0
     from public.feed_posts where id = '00000000-0000-4000-ff00-000000000002'),
  'the tally follows the update'
);
select feed_tests.check_raises(
  $$insert into public.votes (post_id, user_id, choice)
    values ('00000000-0000-4000-ff00-000000000002', '00000000-0000-4000-fd00-00000000000b', 'too_low')
    on conflict (post_id, user_id) do update set
      post_id = excluded.post_id, user_id = excluded.user_id, choice = excluded.choice$$,
  '42501',
  'the old upsert shape is refused when a vote already exists too'
);
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000c');
select feed_tests.check(
  feed_tests.changed($$update public.votes set choice = 'just_right'
    where post_id = '00000000-0000-4000-ff00-000000000002'$$) = 0,
  'the same update cannot touch another voter''s vote'
);
select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000b');
delete from public.votes where post_id = '00000000-0000-4000-ff00-000000000002';

-- ---------------------------------------------------------------------------------------------
-- 4. Flood limit on feed_posts (at most 10 posts in an hour)
-- ---------------------------------------------------------------------------------------------

select feed_tests.sign_in('00000000-0000-4000-fd00-00000000000a');
do $$
begin
  -- Author A already has 2 posts in the last hour; insert 8 more to reach 10.
  for i in 3..10 loop
    insert into public.feed_posts (title, body)
    values ('Item ' || i, 'Is item ' || i || ' priced fairly?');
  end loop;
end;
$$;

select feed_tests.check_raises(
  $$insert into public.feed_posts (title, body)
    values ('Item 11', 'Too many posts in an hour')$$,
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

