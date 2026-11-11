-- Behaviour tests for deleting an account: the delete-account function deletes the Auth user,
-- and every row of theirs must go with it, in every table, with nothing standing in the way.
-- Run with Backend/scripts/test-db.sh (local Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists account_tests;

create function account_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- The foreign keys that point at a person: at their Auth user or their public profile.
create view account_tests.person_keys as
select c.conrelid::regclass as tbl, c.conname, a.attname as col, c.confdeltype
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
 where c.contype = 'f'
   and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass);

-- How many rows still point at someone, across every table that can.
create function account_tests.rows_pointing_at(person uuid) returns integer
language plpgsql as $$
declare
  key record;
  found integer;
  total integer := 0;
begin
  for key in select tbl, col from account_tests.person_keys loop
    execute format('select count(*) from %s where %I = $1', key.tbl, key.col) into found using person;
    total := total + found;
  end loop;
  return total;
end;
$$;

-- 1. The schema: a table added later that keeps someone's rows, or blocks their deletion, fails
--    here before it reaches a real account.
select account_tests.check(
  (select count(*) from account_tests.person_keys) >= 15,
  'the audit sees every table that refers to a person'
);
select account_tests.check(
  not exists (select 1 from account_tests.person_keys where confdeltype <> 'c'),
  'every reference to a person is deleted with them: '
    || coalesce((select string_agg(format('%s.%s', tbl, col), ', ')
                   from account_tests.person_keys where confdeltype <> 'c'), 'none left behind')
);
-- Whatever the cascade deletes (their listings, posts, conversations…) mustn't be held in place
-- by something else pointing at it.
select account_tests.check(
  not exists (
    with recursive doomed(rel) as (
      select 'auth.users'::regclass
      union
      select c.conrelid::regclass
        from pg_constraint c
        join doomed d on c.confrelid = d.rel
       where c.contype = 'f' and c.confdeltype = 'c'
    )
    select 1
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid in (select rel from doomed)
       and c.confdeltype not in ('c', 'n', 'd')
  ),
  'nothing a deleted account takes with it is held in place by another table'
);

-- 2. Ana uses everything, with Ben, then deletes her account. Ben keeps his own.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-d000-00000000000a', 'ana-deletes@test', '{"handle":"ana_deletes"}'),
  ('00000000-0000-4000-d000-00000000000b', 'ben-stays@test', '{"handle":"ben_stays"}');

insert into public.feed_posts (id, slug, owner_id, body, estimate_php, moderation_status) values
  ('00000000-0000-4000-d100-00000000000a', 'ana-walkman', '00000000-0000-4000-d000-00000000000a',
   'Walkman from my lola. Fair at 1,900?', 1900, 'approved'),
  ('00000000-0000-4000-d100-00000000000b', 'ben-jacket', '00000000-0000-4000-d000-00000000000b',
   'Denim jacket, worn twice.', 1200, 'approved');
insert into public.comments (id, post_id, parent_id, author_id, body, moderation_status) values
  -- Ana on Ben's post, and Ben's reply to her there.
  ('00000000-0000-4000-d200-000000000001', '00000000-0000-4000-d100-00000000000b', null,
   '00000000-0000-4000-d000-00000000000a', 'Fair price!', 'approved'),
  ('00000000-0000-4000-d200-000000000002', '00000000-0000-4000-d100-00000000000b',
   '00000000-0000-4000-d200-000000000001', '00000000-0000-4000-d000-00000000000b', 'Thanks!',
   'approved'),
  -- Ben on Ana's post, and on his own.
  ('00000000-0000-4000-d200-000000000003', '00000000-0000-4000-d100-00000000000a', null,
   '00000000-0000-4000-d000-00000000000b', 'A bit high.', 'approved'),
  ('00000000-0000-4000-d200-000000000004', '00000000-0000-4000-d100-00000000000b', null,
   '00000000-0000-4000-d000-00000000000b', 'Still available.', 'approved');
insert into public.comment_reports (comment_id, reporter_id) values
  ('00000000-0000-4000-d200-000000000004', '00000000-0000-4000-d000-00000000000a'),
  ('00000000-0000-4000-d200-000000000001', '00000000-0000-4000-d000-00000000000b');

insert into public.listings (id, slug, seller_id, title, asking_php, moderation_status) values
  ('00000000-0000-4000-d300-00000000000a', 'ana-lamp', '00000000-0000-4000-d000-00000000000a',
   'Brass lamp', 1500, 'approved'),
  ('00000000-0000-4000-d300-00000000000b', 'ben-radio', '00000000-0000-4000-d000-00000000000b',
   'Transistor radio', 900, 'approved');
-- Ana buys Ben's radio; Ben buys Ana's lamp.
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d300-00000000000b',
   '00000000-0000-4000-d000-00000000000a', '00000000-0000-4000-d000-00000000000b'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d300-00000000000a',
   '00000000-0000-4000-d000-00000000000b', '00000000-0000-4000-d000-00000000000a');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d000-00000000000a'),
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d000-00000000000b'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d000-00000000000a'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d000-00000000000b');
insert into public.messages (conversation_id, sender_id, kind, body, offer_php) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d000-00000000000a', 'text',
   'Is the radio working?', null),
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d000-00000000000b', 'text',
   'Yes, new batteries.', null),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d000-00000000000b', 'offer',
   '', 1300);
insert into public.conversation_reports (conversation_id, reporter_id, reason) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d000-00000000000b', 'spam');
insert into public.user_blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-d000-00000000000a', '00000000-0000-4000-d000-00000000000b'),
  ('00000000-0000-4000-d000-00000000000b', '00000000-0000-4000-d000-00000000000a');
insert into public.suki_discounts (seller_id, buyer_id, discount_pct) values
  ('00000000-0000-4000-d000-00000000000a', '00000000-0000-4000-d000-00000000000b', 10),
  ('00000000-0000-4000-d000-00000000000b', '00000000-0000-4000-d000-00000000000a', 5);
insert into public.hanap_posts (author_id, body, max_php) values
  ('00000000-0000-4000-d000-00000000000a', 'Polaroid film, any kind', 800),
  ('00000000-0000-4000-d000-00000000000b', 'Size 9 running shoes', 1500);
insert into public.scan_history (user_id, item_name, amount_php, low_php, high_php) values
  ('00000000-0000-4000-d000-00000000000a', 'Walkman', 1900, 1600, 2200),
  ('00000000-0000-4000-d000-00000000000b', 'Radio', 900, 700, 1100);

select account_tests.check(
  account_tests.rows_pointing_at('00000000-0000-4000-d000-00000000000a') >= 15,
  'before deleting, Ana has rows across the tables'
);

-- What delete-account does, through the service role: delete the Auth user.
delete from auth.users where id = '00000000-0000-4000-d000-00000000000a';

select account_tests.check(
  account_tests.rows_pointing_at('00000000-0000-4000-d000-00000000000a') = 0,
  'after deleting, no row anywhere refers to Ana'
);
select account_tests.check(
  not exists (select 1 from public.profiles where id = '00000000-0000-4000-d000-00000000000a'),
  'her profile and handle are gone'
);
select account_tests.check(
  not exists (select 1 from public.comments
               where post_id = '00000000-0000-4000-d100-00000000000a'
                  or id = '00000000-0000-4000-d200-000000000001'),
  'her post goes with its discussion, and her comments with the replies under them'
);
select account_tests.check(
  not exists (select 1 from public.conversations
               where id in ('00000000-0000-4000-d400-000000000001',
                            '00000000-0000-4000-d400-000000000002'))
  and not exists (select 1 from public.messages
                   where conversation_id in ('00000000-0000-4000-d400-000000000001',
                                             '00000000-0000-4000-d400-000000000002')),
  'her conversations go, with every message in them'
);
select account_tests.check(
  (select count(*) from public.profiles where id = '00000000-0000-4000-d000-00000000000b') = 1
  and (select count(*) from public.feed_posts where owner_id = '00000000-0000-4000-d000-00000000000b') = 1
  and (select count(*) from public.comments where id = '00000000-0000-4000-d200-000000000004') = 1
  and (select count(*) from public.listings where seller_id = '00000000-0000-4000-d000-00000000000b') = 1
  and (select count(*) from public.hanap_posts where author_id = '00000000-0000-4000-d000-00000000000b') = 1
  and (select count(*) from public.scan_history where user_id = '00000000-0000-4000-d000-00000000000b') = 1,
  'Ben keeps his profile, post, own comment, listing, hanap and scans'
);
select account_tests.check(
  not exists (select 1 from public.comment_reports where reporter_id = '00000000-0000-4000-d000-00000000000b'
               and comment_id = '00000000-0000-4000-d200-000000000001')
  and not exists (select 1 from public.suki_discounts
                   where '00000000-0000-4000-d000-00000000000a' in (seller_id, buyer_id))
  and not exists (select 1 from public.user_blocks
                   where '00000000-0000-4000-d000-00000000000a' in (blocker_id, blocked_id)),
  'reports, blocks and suki discounts involving her go too'
);
select account_tests.check(
  (select count(*) from public.profiles where handle in ('retro_curator', 'mariacruz')) = 2,
  'nobody else is touched'
);

-- 3. Her handle is free again for someone new.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-d000-00000000000c', 'new-ana@test', '{"handle":"ana_deletes"}');
select account_tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-d000-00000000000c')
    = 'ana_deletes',
  'a deleted account''s handle can be taken again'
);

\echo 'All account deletion tests passed.'
