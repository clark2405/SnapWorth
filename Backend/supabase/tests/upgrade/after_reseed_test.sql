-- After the seeds are run again over the upgraded database, which the deploy checklist offers as
-- the way to give the demo listings and posts their new details (category, photos aside, AI
-- estimate, vote counts). Nothing real may be lost or overwritten, and the old rows have to end up
-- as the current seed describes them. Then an account is deleted, with everything it touched.
-- Run by `Backend/scripts/test-db.sh --upgrade`.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- (`upgrade_tests.check` is the helper after_migrations_test.sql made, in the same database.)

-- 1. The demo listings now have their details and are approved; ids and slugs are as before.
select upgrade_tests.check(
  (select count(*) from public.listings
    where id::text like '00000000-0000-4000-9100-00000000000%'
      and slug in ('polaroid-sun-600', 'air-jordan-1-bred', 'retro-walkman', 'keychron-keyboard',
                   'nike-teal-windbreaker', 'colour-block-windbreaker', 'black-puffer-jacket',
                   'polaroid-film-bundle')
      and moderation_status = 'approved' and estimate_php is not null and description <> '') = 8,
  'the eight demo listings have their details, estimate and approval, under the same ids and slugs'
);
select upgrade_tests.check(
  (select category || '|' || condition || '|' || area from public.listings where slug = 'nike-teal-windbreaker')
  = 'fashion|like_new|lapu-lapu',
  'with the details the current seed gives them'
);
-- 2. What people did is untouched by the seed.
select upgrade_tests.check(
  (select count(*) from public.conversations) = 4
  and (select listing_id from public.conversations where id = '00000000-0000-4000-c000-000000000001')
      = '00000000-0000-4000-9100-000000000001'
  and (select count(*) from public.messages
        where conversation_id = '00000000-0000-4000-c000-000000000001') = 6,
  'conversations and their messages are as the people left them'
);
select upgrade_tests.check(
  (select moderation_status from public.listings where slug = 'taken-down-lamp') = 'removed'
  and (select status from public.listings where slug = 'sold-film-camera') = 'sold'
  and (select title from public.listings where title = 'Brand new thing') is not null,
  'listings the seed does not know about, the sold one and the removed one are left alone'
);
select upgrade_tests.check(
  (select too_high_count from public.feed_posts where id = '00000000-0000-4000-9000-000000000002') >= 1
  and (select count(*) from public.feed_posts) = 6
  and (select title from public.feed_posts where id = '00000000-0000-4000-9000-000000000002') <> '',
  'the seed gives the demo posts their titles and counts; people''s posts stay'
);
select upgrade_tests.check(
  (select count(*) from public.comments where body = 'New comment from the old app') = 1
  and (select moderation_status from public.comments
        where id = '00000000-0000-4000-a000-000000000009') = 'held',
  'comments, including held ones, are not changed by it'
);

-- 3. Deleting an account removes what it touched, old and new, without a foreign key getting in
--    the way: Tomas's chats, comments, hanap, reports, votes and block go with him.
delete from auth.users where id = '00000000-0000-4000-b000-000000000002';
select upgrade_tests.check(
  not exists (select 1 from public.profiles where id = '00000000-0000-4000-b000-000000000002')
  and not exists (select 1 from public.conversations where buyer_id = '00000000-0000-4000-b000-000000000002')
  and not exists (select 1 from public.votes where user_id = '00000000-0000-4000-b000-000000000002')
  and not exists (select 1 from public.comments where author_id = '00000000-0000-4000-b000-000000000002')
  and not exists (select 1 from public.hanap_posts where author_id = '00000000-0000-4000-b000-000000000002')
  and not exists (select 1 from public.user_blocks where blocked_id = '00000000-0000-4000-b000-000000000002')
  and (select too_high_count from public.feed_posts where id = '00000000-0000-4000-9000-000000000002') >= 0,
  'an account that has chats, votes, comments, Hanap and a block can be deleted'
);

\echo 'All upgrade re-seed checks passed.'
