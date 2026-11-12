-- After the newer migrations have been applied on top of the live project's rows
-- (01_live_data.sql): the rows survived, the backfills made old rows behave as before, and what
-- the OLD app (the current `main`: chats by `start_conversation(slug)`, `conversation_list`,
-- `comment_thread`, comments, handles) still does. Then a few things only the new app does, on old
-- rows. Run by `Backend/scripts/test-db.sh --upgrade`. Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema upgrade_tests;
grant usage on schema upgrade_tests to anon, authenticated, service_role;

create function upgrade_tests.sign_in(who uuid) returns void
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

create function upgrade_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function upgrade_tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema upgrade_tests to anon, authenticated, service_role;

-- The cast (see 01_live_data.sql): Rina buys, Tomas is a regular who was reported and blocked,
-- Maria sells most of the listings, Retro Curator sells the windbreaker, Justin becomes the admin.
create table upgrade_tests.who (name text primary key, id uuid not null);
insert into upgrade_tests.who values
  ('rina', '00000000-0000-4000-b000-000000000001'),
  ('tomas', '00000000-0000-4000-b000-000000000002'),
  ('maria', '00000000-0000-4000-8000-000000000002'),
  ('retro', '00000000-0000-4000-8000-000000000001'),
  ('justin', '00000000-0000-4000-8000-000000000004');
grant select on upgrade_tests.who to anon, authenticated, service_role;

create function upgrade_tests.as_user(name text) returns void
language plpgsql as $$
begin
  perform upgrade_tests.sign_in((select w.id from upgrade_tests.who w where w.name = as_user.name));
end;
$$;
grant execute on function upgrade_tests.as_user(text) to anon, authenticated, service_role;

-- 1. Nothing was lost.
select upgrade_tests.check(
  not exists (
    select 1
      from upgrade_fixture.counts c
      join (
        select 'profiles' as tbl, count(*) as n from public.profiles
        union all select 'feed_posts', count(*) from public.feed_posts
        union all select 'comments', count(*) from public.comments
        union all select 'comment_reports', count(*) from public.comment_reports
        union all select 'listings', count(*) from public.listings
        union all select 'conversations', count(*) from public.conversations
        union all select 'conversation_members', count(*) from public.conversation_members
        union all select 'messages', count(*) from public.messages
        union all select 'conversation_reports', count(*) from public.conversation_reports
        union all select 'user_blocks', count(*) from public.user_blocks
        union all select 'hanap_posts', count(*) from public.hanap_posts
        union all select 'suki_discounts', count(*) from public.suki_discounts
        union all select 'meetup_spots', count(*) from public.meetup_spots
      ) now_counts using (tbl)
     where c.n <> now_counts.n
  ),
  'every table still has the rows it had before the upgrade'
);
select upgrade_tests.check(
  (select count(*) from public.messages where kind = 'offer' and offer_status = 'countered') = 1
  and (select count(*) from public.messages where kind = 'meetup' and meetup_status = 'confirmed') = 1
  and (select count(*) from public.feed_posts where moderation_status = 'approved') = 2,
  'and statuses on old messages and posts are as they were'
);
select upgrade_tests.check(
  (select string_agg(handle, ',' order by handle) from public.profiles
    where id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002'))
  = 'rina_buys,user_0000000000'
  and not exists (
    select 1 from public.profiles
     where id <> '00000000-0000-4000-b000-000000000003'
       and (display_name <> '' or bio <> '' or location <> '' or avatar_url is not null)
  ),
  'profiles keep their handles, and the new profile fields start empty'
);
select upgrade_tests.check(
  (select handle = 'paolo_finds' and display_name = 'Paolo Reyes'
          and bio = 'Ukay finds, mostly cameras.' and location = 'Mandaue City'
          and avatar_url is null
     from public.profiles where id = '00000000-0000-4000-b000-000000000003'),
  'the profile details an account had only in its metadata are copied to its profile (not the photo)'
);

-- 2. Backfills: listings that were public stay public, and new ones start unscreened.
select upgrade_tests.check(
  (select count(*) from public.listings
    where moderation_status = 'approved' and moderation_ref = 'before-moderation') = 9
  and (select moderation_status from public.listings where slug = 'taken-down-lamp') = 'removed',
  'every existing listing that was public is approved, and the removed one stays removed'
);
select upgrade_tests.check(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'moderation_status')
  like '''pending''%',
  'but a new listing still starts pending'
);
select upgrade_tests.check(
  (select count(*) from public.listings where estimate_php is not null or verdict is not null) = 0
  and (select count(*) from public.listings where category = 'collectibles' and condition = 'good'
        and area = 'cebu-city' and description = '' and photo_path is null) = 10,
  'existing listings carry no AI estimate or verdict (there is none to copy) and the new fields'' defaults'
);
select upgrade_tests.check(
  (select count(*) from public.feed_posts where estimate_php is not null) = 4
  and (select count(*) from public.feed_posts where title = '' and category is null) = 4
  and (select sum(too_high_count + just_right_count + too_low_count) from public.feed_posts) = 0,
  'old feed posts keep their estimates; their titles, categories and vote counts start empty'
);
select upgrade_tests.check(
  (select public from storage.buckets where id = 'scan-photos') = false
  and (select public from storage.buckets where id = 'avatars') = true,
  'the photo buckets exist, scan photos private and profile photos public'
);

-- 3. The old app, signed out.
set role anon;
select upgrade_tests.sign_in(null);
select upgrade_tests.check(
  (select count(*) from public.listings) = 9
  and not exists (select 1 from public.listings where slug = 'taken-down-lamp'),
  'a visitor still sees every listing that is not removed (the Market is not emptied)'
);
select upgrade_tests.check(
  (select count(*) from public.feed_posts) = 2,
  'and the approved feed posts, not the held or pending ones'
);
select upgrade_tests.check(
  (select count(*) from public.comment_thread('polaroid-sun-600')) = 2
  and (select count(*) from public.comment_thread('retro-windbreaker')) = 3,
  'the discussion on a seeded post reads as before, replies included'
);
select upgrade_tests.check(
  (select count(*) from public.hanap_posts) = 1 and (select count(*) from public.meetup_spots) = 9,
  'Hanap shows its one open approved post, and the meetup spots are there'
);
reset role;

-- 4. The old app, signed in as the buyer with chats already open.
set role authenticated;
select upgrade_tests.as_user('rina');
select upgrade_tests.check(
  public.start_conversation('polaroid-sun-600') = '00000000-0000-4000-c000-000000000001'
  and public.start_conversation('sold-film-camera') = '00000000-0000-4000-c000-000000000002',
  'opening a listing she already chats about returns the existing conversation, sold or not'
);
select upgrade_tests.check(
  (select count(*) from public.conversation_list()) = 2
  and (select listing_slug || '|' || coalesce(closed, 'open') || '|' || unread_count || '|'
              || i_am_seller::text || '|' || other_handle
         from public.conversation_list() where id = '00000000-0000-4000-c000-000000000001')
      = 'polaroid-sun-600|open|2|false|mariacruz'
  and (select closed from public.conversation_list() where id = '00000000-0000-4000-c000-000000000002')
      = 'sold',
  'her chat list is intact: the listing, the sold chat, who it is with and what is unread'
);
select upgrade_tests.check(
  public.start_conversation('retro-walkman') is not null,
  'she can start a chat about another seeded listing (it is approved, not pending)'
);
select upgrade_tests.check_rejected(
  $$select public.start_conversation('taken-down-lamp')$$,
  array['P0002'],
  'a removed listing still can''t be messaged'
);
insert into public.messages (conversation_id, body)
values ('00000000-0000-4000-c000-000000000001', 'Can we meet at SM?');
select upgrade_tests.check(
  (select count(*) from public.messages
    where conversation_id = '00000000-0000-4000-c000-000000000001') = 6,
  'she can send into the existing chat with the old app''s columns'
);
select public.confirm_meetup('00000000-0000-4000-d100-000000000004');
select public.mark_conversation_read('00000000-0000-4000-c000-000000000001');
select upgrade_tests.check(
  (select unread_count from public.conversation_list('00000000-0000-4000-c000-000000000001')) = 0,
  'confirming a meetup and marking read work on old messages'
);
-- The old app's comment screen.
insert into public.comments (post_id, body)
values ('00000000-0000-4000-9000-000000000002', 'New comment from the old app');
select upgrade_tests.check(
  (select moderation_status from public.comment_thread('polaroid-sun-600')
    where body = 'New comment from the old app') = 'pending'
  and (select count(*) from public.comment_thread('polaroid-sun-600')) = 5,
  'a comment on a seeded post is accepted pending, and she sees hers, her held one and her pending one'
);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a000-000000000009', 'spam')
on conflict do nothing;
update public.profiles set handle = 'rina_new' where id = '00000000-0000-4000-b000-000000000001';
select upgrade_tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-b000-000000000001') = 'rina_new'
  and (select count(*) from public.hanap_posts) = 2
  and (select discount_pct from public.suki_discounts) = 10,
  'she can change her handle, still sees her own held Hanap post and her suki discount'
);
reset role;
select upgrade_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a000-000000000009') = 'held',
  'a third report still holds an approved comment (nobody has decided on the old ones)'
);

-- The seller's side.
set role authenticated;
select upgrade_tests.as_user('maria');
select public.respond_to_offer('00000000-0000-4000-d100-000000000005', true);
select upgrade_tests.check(
  (select count(*) from public.listings where seller_id = (select id from upgrade_tests.who where name = 'maria')) = 4
  and (select count(*) from public.conversation_list()) = 2,
  'a seller sees all her listings and chats, and answers an offer'
);
reset role;
set role authenticated;
select upgrade_tests.as_user('tomas');
select upgrade_tests.check(
  public.start_conversation('nike-teal-windbreaker') = '00000000-0000-4000-c000-000000000003',
  'a reported, blocked regular still gets his existing conversation back'
);
select upgrade_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-4000-c000-000000000003', 'Hello?')$$,
  array['SWBLK'],
  'and the block still stops his messages'
);
reset role;

-- 5. The new app on old rows: votes, edits, new listings, the admin.
set role authenticated;
select upgrade_tests.as_user('tomas');
insert into public.votes (post_id, choice) values ('00000000-0000-4000-9000-000000000002', 'too_high');
select upgrade_tests.check(
  (select too_high_count from public.feed_posts where id = '00000000-0000-4000-9000-000000000002') = 1,
  'a vote on an old post is counted on it'
);
select upgrade_tests.check_rejected(
  $$insert into public.votes (post_id, choice)
    values ('00000000-0000-4000-9000-00000000000c', 'too_high')$$,
  array['42501'],
  'but not on a post that is still pending'
);
select upgrade_tests.as_user('maria');
update public.listings set asking_php = 3100 where slug = 'polaroid-sun-600';
update public.listings set status = 'sold' where slug = 'keychron-keyboard';
select upgrade_tests.check(
  (select asking_php || '|' || moderation_status from public.listings where slug = 'polaroid-sun-600')
  = '3100|approved'
  and (select status from public.listings where slug = 'keychron-keyboard') = 'sold',
  'a seller can change the price of an old listing and mark one sold, with no new screening for it'
);
update public.listings set title = 'Vintage Polaroid Sun 600 (tested)' where slug = 'polaroid-sun-600';
select upgrade_tests.check(
  (select moderation_status from public.listings where slug = 'polaroid-sun-600') = 'pending'
  and (select slug from public.listings where id = '00000000-0000-4000-9100-000000000001') = 'polaroid-sun-600',
  'a new title sends it back to screening, and its link does not change'
);
select upgrade_tests.as_user('rina');
select upgrade_tests.check(
  (select count(*) from public.conversation_list()
    where id = '00000000-0000-4000-c000-000000000001') = 1,
  'while it waits, the buyer already in a chat about it still sees that chat'
);
select upgrade_tests.as_user('maria');
insert into public.listings (title, asking_php, category, condition, area, description)
values ('Brand new thing', 500, 'home', 'good', 'mandaue', 'Made by the new app');
select upgrade_tests.check(
  (select moderation_status from public.listings where title = 'Brand new thing') = 'pending',
  'a new listing from the new app starts pending'
);
select upgrade_tests.as_user('rina');
select upgrade_tests.check_rejected(
  $$select public.start_conversation((select slug from public.listings where title = 'Brand new thing'))$$,
  array['P0002'],
  'and can''t be messaged until it is approved'
);
reset role;

insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000004');
set role authenticated;
select upgrade_tests.as_user('justin');
select upgrade_tests.check(
  (select array_agg(kind || ':' || coalesce(status::text, '-') || ':' || target_id::text order by kind, target_id)
     from public.admin_review_queue() where kind <> 'listing')
  = array[
      'comment:pending:00000000-0000-4000-a000-000000000007',
      'comment:held:00000000-0000-4000-a000-000000000008',
      'comment:held:00000000-0000-4000-a000-000000000009',
      'conversation:-:00000000-0000-4000-c000-000000000003',
      'hanap:held:00000000-0000-4000-e100-000000000002',
      'hanap:pending:00000000-0000-4000-e100-000000000004',
      'post:held:00000000-0000-4000-9000-00000000000b',
      'post:pending:00000000-0000-4000-9000-00000000000c'
    ],
  'the admin''s queue reads the old held, stuck and reported content (and an old report is open)'
);
reset role;

-- 3. Chats survive an account deletion (20261112000100): the old chats are untouched, and the
--    references that used to cascade now empty the deleted person's side instead.
select upgrade_tests.check(
  (select count(*) = 3 from public.conversations
    where id in ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000002',
                 '00000000-0000-4000-c000-000000000003')
      and buyer_id is not null and seller_id is not null and listing_id is not null),
  'every chat the old app made is still there, with both people and its listing'
);
select upgrade_tests.check(
  (select count(*) = 4
     from pg_constraint c
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confdeltype = 'n'
      and (c.conrelid::regclass::text, a.attname) in (
        ('conversations', 'listing_id'), ('conversations', 'buyer_id'),
        ('conversations', 'seller_id'), ('messages', 'sender_id'))),
  'a chat''s listing, people and message senders are set to null, not deleted, when they go'
);

\echo 'All upgrade checks passed.'
