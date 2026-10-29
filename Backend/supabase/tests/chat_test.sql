-- Behaviour tests for chats: who can start and see a conversation, sending, offers, pickups,
-- reads, blocks, reports, closing on sale, and the limits a client cannot get around. Run with
-- Backend/scripts/test-db.sh (local Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists chat_tests;
grant usage on schema chat_tests to anon, authenticated, service_role;

create function chat_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function chat_tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema chat_tests to anon, authenticated, service_role;

-- Sam sells; Bea and Bo buy; Eve is not in any conversation.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-d000-00000000005a', 'sam@test', '{"handle":"sam_sells"}'),
  ('00000000-0000-4000-d000-0000000000be', 'bea@test', '{"handle":"bea_buys"}'),
  ('00000000-0000-4000-d000-0000000000b0', 'bo@test', '{"handle":"bo_buys"}'),
  ('00000000-0000-4000-d000-0000000000e0', 'eve@test', '{"handle":"eve_reads"}');

insert into public.listings (id, slug, seller_id, title, asking_php, status) values
  ('00000000-0000-4000-e000-000000000001', 'test-lamp', '00000000-0000-4000-d000-00000000005a',
   'Brass desk lamp', 1500, 'active'),
  ('00000000-0000-4000-e000-000000000002', 'test-radio', '00000000-0000-4000-d000-00000000005a',
   'Transistor radio', 900, 'sold'),
  ('00000000-0000-4000-e000-000000000003', 'test-stool', '00000000-0000-4000-d000-00000000005a',
   'Wooden stool', 700, 'active');

create table chat_tests.ids (name text primary key, id uuid);
grant all on chat_tests.ids to authenticated;

-- 1. Starting a conversation.
set role anon;
select chat_tests.check_rejected(
  $$select public.start_conversation('test-lamp')$$,
  array['42501'],
  'guests cannot start a conversation'
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
insert into chat_tests.ids values ('lamp', public.start_conversation('test-lamp'));
select chat_tests.check(
  public.start_conversation('test-lamp') = (select id from chat_tests.ids where name = 'lamp'),
  'messaging the same seller about the same listing reopens the one conversation'
);
select chat_tests.check_rejected(
  $$select public.start_conversation('test-radio')$$,
  array['SWCLO'],
  'a sold listing cannot start a new conversation'
);
select chat_tests.check_rejected(
  $$select public.start_conversation('no-such-thing')$$,
  array['P0002'],
  'an unknown listing cannot start a conversation'
);
select chat_tests.check_rejected(
  $$insert into public.conversations (listing_id, buyer_id, seller_id)
    values ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-0000000000be',
            '00000000-0000-4000-d000-00000000005a')$$,
  array['42501'],
  'conversations cannot be inserted directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-00000000005a', false);
select chat_tests.check_rejected(
  $$select public.start_conversation('test-lamp')$$,
  array['22023'],
  'a seller cannot message themselves about their own listing'
);

-- 2. Sending.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
insert into public.messages (id, conversation_id, body)
values ('00000000-0000-4000-f000-000000000001', (select id from chat_tests.ids where name = 'lamp'),
        '  Hi! Is the lamp still available?  ');
select chat_tests.check(
  (select body from public.messages where id = '00000000-0000-4000-f000-000000000001')
    = 'Hi! Is the lamp still available?',
  'a message is trimmed'
);
select chat_tests.check_rejected(
  $$insert into public.messages (id, conversation_id, body)
    values ('00000000-0000-4000-f000-000000000001',
            (select id from chat_tests.ids where name = 'lamp'), 'again')$$,
  array['23505'],
  'resending with the same id conflicts instead of doubling'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'lamp'), '   ')$$,
  array['23514'],
  'an empty message is refused'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body, sender_id)
    values ((select id from chat_tests.ids where name = 'lamp'), 'as sam',
            '00000000-0000-4000-d000-00000000005a')$$,
  array['42501'],
  'nobody can send as someone else'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, offer_php, offer_status)
    values ((select id from chat_tests.ids where name = 'lamp'), 'offer', 1, 'accepted')$$,
  array['42501'],
  'nobody can send an offer that is already accepted'
);

-- 3. Only the two people can see it.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000e0', false);
select chat_tests.check(
  (select count(*) from public.messages) = 0
    and (select count(*) from public.conversations) = 0
    and (select count(*) from public.conversation_list()) = 0,
  'someone outside the conversation sees nothing of it'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'lamp'), 'butting in')$$,
  array['42501'],
  'someone outside the conversation cannot post in it'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-00000000005a', false);
select chat_tests.check(
  (select unread_count from public.conversation_list()
    where id = (select id from chat_tests.ids where name = 'lamp')) = 1,
  'the seller has one unread message'
);
select chat_tests.check(
  (select other_handle = 'bea_buys' and i_am_seller and not last_from_me
     from public.conversation_list()
    where id = (select id from chat_tests.ids where name = 'lamp')),
  'the seller''s list names the buyer and the latest message'
);
select chat_tests.check(
  (select count(*) from public.conversation_list((select id from chat_tests.ids where name = 'lamp')))
    = 1,
  'the list can be narrowed to one conversation'
);
select public.mark_conversation_read((select id from chat_tests.ids where name = 'lamp'));
select chat_tests.check(
  (select unread_count from public.conversation_list()
    where id = (select id from chat_tests.ids where name = 'lamp')) = 0,
  'reading the conversation clears the unread count'
);

-- 4. Offers.
insert into public.messages (id, conversation_id, kind, offer_php, body)
values ('00000000-0000-4000-f000-000000000002', (select id from chat_tests.ids where name = 'lamp'),
        'offer', 1400, 'Happy to do 1,400.');
select chat_tests.check(
  (select offer_status from public.messages where id = '00000000-0000-4000-f000-000000000002')
    = 'pending',
  'a new offer starts pending'
);
select chat_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-f000-000000000002', true)$$,
  array['22023'],
  'nobody can accept their own offer'
);
select chat_tests.check_rejected(
  $$update public.messages set offer_status = 'accepted'
     where id = '00000000-0000-4000-f000-000000000002'$$,
  array['42501'],
  'an offer''s status cannot be written directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
insert into public.messages (id, conversation_id, kind, offer_php)
values ('00000000-0000-4000-f000-000000000003', (select id from chat_tests.ids where name = 'lamp'),
        'offer', 1200);
select chat_tests.check(
  (select offer_status from public.messages where id = '00000000-0000-4000-f000-000000000002')
    = 'countered',
  'a counter-offer replaces the open one'
);
select chat_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-f000-000000000002', true)$$,
  array['SWOLD'],
  'a countered offer can no longer be accepted'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-00000000005a', false);
select chat_tests.check(
  public.respond_to_offer('00000000-0000-4000-f000-000000000003', true) = 'accepted',
  'the seller accepts the counter-offer'
);
select chat_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-f000-000000000003', false)$$,
  array['SWOLD'],
  'an answered offer cannot be answered again'
);

-- 5. Pickups.
insert into public.messages (id, conversation_id, kind, meetup_place, meetup_when)
values ('00000000-0000-4000-f000-000000000004', (select id from chat_tests.ids where name = 'lamp'),
        'meetup', ' Ayala Triangle Gardens ', 'Saturday, 2:00 PM');
select chat_tests.check(
  (select meetup_status = 'proposed' and meetup_place = 'Ayala Triangle Gardens'
     from public.messages where id = '00000000-0000-4000-f000-000000000004'),
  'a pickup starts proposed'
);
select chat_tests.check_rejected(
  $$select public.confirm_meetup('00000000-0000-4000-f000-000000000004')$$,
  array['22023'],
  'nobody can confirm their own pickup'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
select chat_tests.check(
  public.confirm_meetup('00000000-0000-4000-f000-000000000004') = 'confirmed',
  'the buyer confirms the pickup'
);
select chat_tests.check_rejected(
  $$select public.confirm_meetup('00000000-0000-4000-f000-000000000003')$$,
  array['P0002'],
  'an offer cannot be confirmed as a pickup'
);

-- 5b. Meetups on the map: the spot decides the name and the pin.
select chat_tests.check(
  (select meetup_purpose = 'pickup' and meetup_spot is null and meetup_lat is null
     from public.messages where id = '00000000-0000-4000-f000-000000000004'),
  'a meetup without a spot is a pickup with no pin'
);
insert into public.messages (id, conversation_id, kind, meetup_spot, meetup_place, meetup_when,
                             meetup_purpose)
values ('00000000-0000-4000-f000-000000000005', (select id from chat_tests.ids where name = 'lamp'),
        'meetup', 'megamall', 'My place, 42 Quiet Street', 'Sunday, 10:00 AM', 'viewing');
select chat_tests.check(
  (select meetup_place = 'SM Megamall' and meetup_purpose = 'viewing'
          and meetup_lat = (select lat from public.meetup_spots where key = 'megamall')
          and meetup_lng = (select lng from public.meetup_spots where key = 'megamall')
     from public.messages where id = '00000000-0000-4000-f000-000000000005'),
  'a spot sets the place''s name and pin, whatever name the sender typed'
);
select chat_tests.check(
  (select last_meetup_purpose = 'viewing' and last_meetup_place = 'SM Megamall'
     from public.conversation_list((select id from chat_tests.ids where name = 'lamp'))),
  'the list says the latest message is a viewing at SM Megamall'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, meetup_spot, meetup_when, meetup_lat,
                                 meetup_lng)
    values ((select id from chat_tests.ids where name = 'lamp'), 'meetup', 'megamall', 'Today',
            14.0, 121.0)$$,
  array['42501'],
  'nobody can send their own coordinates'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, meetup_spot, meetup_when)
    values ((select id from chat_tests.ids where name = 'lamp'), 'meetup', 'my-house', 'Today')$$,
  array['22023'],
  'a spot that is not on the list is refused'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, meetup_spot, meetup_when, meetup_purpose)
    values ((select id from chat_tests.ids where name = 'lamp'), 'meetup', 'megamall', 'Today',
            'party')$$,
  array['23514'],
  'a meetup is a pickup or a viewing, nothing else'
);
insert into public.messages (id, conversation_id, body, meetup_spot, meetup_purpose)
values ('00000000-0000-4000-f000-000000000006', (select id from chat_tests.ids where name = 'lamp'),
        'Sounds good', 'megamall', 'viewing');
select chat_tests.check(
  (select meetup_spot is null and meetup_purpose is null and meetup_lat is null
     from public.messages where id = '00000000-0000-4000-f000-000000000006'),
  'only a meetup carries a spot: one sent on a text message is dropped'
);
select chat_tests.check(
  (select count(*) from public.meetup_spots) >= 15,
  'everyone signed in can read the list of meetup spots'
);

-- 6. Reports.
insert into public.conversation_reports (conversation_id, reason)
values ((select id from chat_tests.ids where name = 'lamp'), 'spam');
select chat_tests.check_rejected(
  $$insert into public.conversation_reports (conversation_id, reason)
    values ((select id from chat_tests.ids where name = 'lamp'), 'spam')$$,
  array['23505'],
  'a conversation can be reported once per person'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000e0', false);
select chat_tests.check_rejected(
  $$insert into public.conversation_reports (conversation_id, reason)
    values ((select id from chat_tests.ids where name = 'lamp'), 'spam')$$,
  array['42501'],
  'someone outside the conversation cannot report it'
);

-- 7. Blocks stop messages both ways.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-00000000005a', false);
select public.set_block('00000000-0000-4000-d000-0000000000be', true);
select public.set_block('00000000-0000-4000-d000-0000000000be', true);
select chat_tests.check(
  (select blocked_by_me from public.conversation_list()
    where id = (select id from chat_tests.ids where name = 'lamp')),
  'the seller''s list shows the buyer as blocked'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'lamp'), 'hello?')$$,
  array['SWBLK'],
  'the blocker cannot send'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'lamp'), 'hello?')$$,
  array['SWBLK'],
  'the blocked person cannot send either'
);
select chat_tests.check(
  (select count(*) from public.user_blocks) = 0,
  'the blocked person cannot see who blocked them'
);
select chat_tests.check_rejected(
  $$select public.start_conversation('test-stool')$$,
  array['SWBLK'],
  'the blocked person cannot open a new conversation with the blocker'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-00000000005a', false);
select public.set_block('00000000-0000-4000-d000-0000000000be', false);
insert into public.messages (conversation_id, body)
values ((select id from chat_tests.ids where name = 'lamp'), 'Sorry, wrong button.');
select chat_tests.check(true, 'unblocking lets messages through again');
reset role;

-- 8. A sale closes the conversation.
update public.listings set status = 'sold' where slug = 'test-lamp';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000be', false);
select chat_tests.check(
  (select closed from public.conversation_list()
    where id = (select id from chat_tests.ids where name = 'lamp')) = 'sold',
  'the buyer''s list shows the conversation as sold'
);
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'lamp'), 'still there?')$$,
  array['SWCLO'],
  'nobody can send in a sold conversation'
);
select chat_tests.check(
  public.start_conversation('test-lamp') = (select id from chat_tests.ids where name = 'lamp'),
  'the buyer can still open their past conversation about a sold listing'
);

-- 9. Flood limit: thirty messages a minute.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-d000-0000000000b0', false);
insert into chat_tests.ids values ('stool', public.start_conversation('test-stool'));
insert into public.messages (conversation_id, body)
select (select id from chat_tests.ids where name = 'stool'), 'flood ' || n
  from generate_series(1, 30) n;
select chat_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ((select id from chat_tests.ids where name = 'stool'), 'one too many')$$,
  array['P0001'],
  'a thirty-first message within a minute is refused'
);
reset role;

\echo 'All chat tests passed.'
