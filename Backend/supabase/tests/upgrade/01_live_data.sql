-- The live project as it is today: rows written by the old app and the old seeds, on the schema
-- of every migration up to and including 20261031000200_profile_handles. Applied by
-- `Backend/scripts/test-db.sh --upgrade` before the newer migrations, so they run against a
-- database that already has data. It uses only columns that exist at that point: nothing here
-- may mention a column a later migration adds.
--
-- Cast: four demo accounts (the dev seed's, with its two feed posts, eight listings and
-- discussions), and two real people. Rina buys. Tomas, a demo seller's regular, has a sold
-- listing's chat. Nobody has a moderation state on a listing yet: the column doesn't exist.

\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'retro_curator@seed.snapworth.test', '{"handle":"retro_curator"}'),
  ('00000000-0000-4000-8000-000000000002', 'mariacruz@seed.snapworth.test', '{"handle":"mariacruz"}'),
  ('00000000-0000-4000-8000-000000000003', 'sugbo_hype@seed.snapworth.test', '{"handle":"sugbo_hype"}'),
  ('00000000-0000-4000-8000-000000000004', 'justin_v@seed.snapworth.test', '{"handle":"justin_v"}'),
  -- Real accounts: Rina picked a handle at sign-up, Tomas didn't (so he has the derived one).
  ('00000000-0000-4000-b000-000000000001', 'rina@example.com', '{"handle":"rina_buys"}'),
  ('00000000-0000-4000-b000-000000000002', 'tomas@example.com', '{}');

-- The two seed feed posts the live project has, and two the current seed adds later: the old
-- shape has no title, category or counters.
insert into public.feed_posts (id, slug, owner_id, body, estimate_php, moderation_status, created_at) values
  ('00000000-0000-4000-9000-000000000001', 'retro-windbreaker', '00000000-0000-4000-8000-000000000001',
   'Just picked up this retro 90s Nike teal windbreaker. AI valued it at ₱2,450. Is this fair? Community let me know!',
   2450, 'approved', now() - interval '2 days'),
  ('00000000-0000-4000-9000-000000000002', 'polaroid-sun-600', '00000000-0000-4000-8000-000000000002',
   'Is a vintage polaroid camera worth ₱3,500? Help me out please!',
   3500, 'approved', now() - interval '1 day'),
  -- One a person made that moderation is still holding, and one waiting to be screened.
  ('00000000-0000-4000-9000-00000000000b', 'rina-held-post', '00000000-0000-4000-b000-000000000001',
   'Is ₱900 fair for these shoes? Text me on Viber.', 900, 'held', now() - interval '5 hours'),
  ('00000000-0000-4000-9000-00000000000c', 'rina-pending-post', '00000000-0000-4000-b000-000000000001',
   'Is ₱400 fair for this lamp?', 400, 'pending', now() - interval '1 hour');

insert into public.comments (id, post_id, parent_id, author_id, body, moderation_status, moderation_ref,
                             moderated_at, created_at) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-9000-000000000001', null,
   '00000000-0000-4000-8000-000000000004', 'Check the inner tag.', 'approved', 'rules', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-9000-000000000001', null,
   '00000000-0000-4000-8000-000000000003', 'Teal colourways go fast.', 'approved', 'rules', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-8000-000000000004', 'Sun 600s usually go for less.', 'approved', 'rules', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-9000-000000000002',
   '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-8000-000000000002',
   'Good to know, thanks.', 'approved', 'rules', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-a000-000000000007', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-b000-000000000001', 'Rina''s comment, still pending.', 'pending', null, null, now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000008', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-b000-000000000001', 'Rina''s held comment.', 'held', 'rules (scam accusation)', now() - interval '3 hours', now() - interval '4 hours'),
  ('00000000-0000-4000-a000-000000000009', '00000000-0000-4000-9000-000000000001', null,
   '00000000-0000-4000-b000-000000000002', 'Tomas''s comment, approved and about to be reported.', 'approved', 'rules', now() - interval '1 day', now() - interval '1 day');
insert into public.comment_reports (comment_id, reporter_id, reason) values
  ('00000000-0000-4000-a000-000000000009', '00000000-0000-4000-8000-000000000001', 'spam'),
  ('00000000-0000-4000-a000-000000000009', '00000000-0000-4000-8000-000000000002', 'harassment');

-- The eight seeded listings (old shape: no category, photo, moderation) and two more: one sold,
-- one a seller's own take-down.
insert into public.listings (id, slug, seller_id, title, asking_php, status) values
  ('00000000-0000-4000-9100-000000000001', 'polaroid-sun-600', '00000000-0000-4000-8000-000000000002', 'Vintage Polaroid Sun 600', 3200, 'active'),
  ('00000000-0000-4000-9100-000000000002', 'air-jordan-1-bred', '00000000-0000-4000-8000-000000000004', 'Air Jordan 1 High Bred', 8500, 'active'),
  ('00000000-0000-4000-9100-000000000003', 'retro-walkman', '00000000-0000-4000-8000-000000000003', 'Retro Walkman Player', 1900, 'active'),
  ('00000000-0000-4000-9100-000000000004', 'keychron-keyboard', '00000000-0000-4000-8000-000000000002', 'Mechanical Keychron Keyboard', 4500, 'active'),
  ('00000000-0000-4000-9100-000000000005', 'nike-teal-windbreaker', '00000000-0000-4000-8000-000000000001', 'Retro Nike Teal Windbreaker', 2600, 'active'),
  ('00000000-0000-4000-9100-000000000006', 'colour-block-windbreaker', '00000000-0000-4000-8000-000000000003', '90s Colour-Block Windbreaker', 1950, 'active'),
  ('00000000-0000-4000-9100-000000000007', 'black-puffer-jacket', '00000000-0000-4000-8000-000000000004', 'Black Quilted Puffer Jacket', 2900, 'active'),
  ('00000000-0000-4000-9100-000000000008', 'polaroid-film-bundle', '00000000-0000-4000-8000-000000000002', 'Polaroid Camera and Film Bundle', 3800, 'active'),
  ('00000000-0000-4000-9100-000000000009', 'sold-film-camera', '00000000-0000-4000-8000-000000000002', 'Sold film camera', 2000, 'active'),
  ('00000000-0000-4000-9100-00000000000a', 'taken-down-lamp', '00000000-0000-4000-8000-000000000001', 'Taken-down lamp', 700, 'removed');

-- Chats the old app made: Rina with Maria about the Polaroid (text, an offer later countered by a
-- newer one, a meetup confirmed), Rina with Maria about the sold camera, and Tomas with Retro
-- Curator about a windbreaker, which Tomas reported.
insert into public.conversations (id, listing_id, buyer_id, seller_id, created_at, last_message_at) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-9100-000000000001',
   '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '3 days', now() - interval '1 hour'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-9100-000000000009',
   '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '6 days', now() - interval '5 days'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-9100-000000000005',
   '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days');
insert into public.conversation_members (conversation_id, user_id, last_read_at) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '2 hours'),
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '3 hours'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '5 days'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-8000-000000000002', now() - interval '5 days'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000002', now() - interval '2 days'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-8000-000000000001', now() - interval '2 days');
insert into public.messages (id, conversation_id, sender_id, kind, body, offer_php, meetup_place, meetup_when, meetup_spot, meetup_lat, meetup_lng) values
  ('00000000-0000-4000-d100-000000000001', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'text', 'Is the Polaroid still available?', null, null, null, null, null, null),
  ('00000000-0000-4000-d100-000000000002', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-8000-000000000002', 'text', 'Yes! Tested last week.', null, null, null, null, null, null),
  ('00000000-0000-4000-d100-000000000003', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'offer', '', 2800, null, null, null, null, null),
  ('00000000-0000-4000-d100-000000000004', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-8000-000000000002', 'meetup', '', null, 'SM City Cebu', 'Today, 2:00 PM', 'sm-city-cebu', null, null),
  ('00000000-0000-4000-d100-000000000005', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'offer', '', 3000, null, null, null, null, null),
  ('00000000-0000-4000-d100-000000000006', '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'text', 'Hi, is this still for sale?', null, null, null, null, null, null),
  ('00000000-0000-4000-d100-000000000007', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000002', 'text', 'Can you do 2,000?', null, null, null, null, null, null);
-- Sending counts as reading, so Rina's own later messages moved her read mark: put it back to where
-- she last opened the chat, which leaves Maria's two messages unread.
update public.conversation_members set last_read_at = now() - interval '2 hours'
 where conversation_id = '00000000-0000-4000-c000-000000000001'
   and user_id = '00000000-0000-4000-b000-000000000001';
update public.messages set meetup_status = 'confirmed' where id = '00000000-0000-4000-d100-000000000004';
-- The camera sold after its chat (a closed chat takes no new messages, so it is marked now).
update public.listings set status = 'sold' where id = '00000000-0000-4000-9100-000000000009';
insert into public.conversation_reports (conversation_id, reporter_id, reason) values
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000002', 'scam');
insert into public.user_blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-b000-000000000002');

-- Hanap: approved, held and pending posts; suki: Maria's regular is Rina.
insert into public.hanap_posts (id, author_id, body, max_php, status, moderation_status, moderation_ref, moderated_at, created_at) values
  ('00000000-0000-4000-e100-000000000001', '00000000-0000-4000-b000-000000000001', 'Looking for a Nike windbreaker, size M', 1500, 'open', 'approved', 'rules', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-e100-000000000002', '00000000-0000-4000-b000-000000000001', 'Looking for a PS5, text me on Viber', null, 'open', 'held', 'rules (off-platform contact)', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-e100-000000000003', '00000000-0000-4000-b000-000000000002', 'Wanted: a film camera', 3000, 'found', 'approved', 'rules', now() - interval '4 days', now() - interval '4 days'),
  ('00000000-0000-4000-e100-000000000004', '00000000-0000-4000-b000-000000000002', 'Wanted: a Walkman', 2000, 'open', 'pending', null, null, now() - interval '20 minutes');
insert into public.suki_discounts (seller_id, buyer_id, discount_pct) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-b000-000000000001', 10);

-- Row counts as they are before the upgrade, for the checks afterwards.
create schema upgrade_fixture;
create table upgrade_fixture.counts as
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
union all select 'meetup_spots', count(*) from public.meetup_spots;
