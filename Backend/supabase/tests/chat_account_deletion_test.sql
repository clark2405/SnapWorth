-- Behaviour tests for chats when someone deletes their account or their listing
-- (20261112000100_chats_survive_account_deletion.sql): the other person keeps the conversation and
-- can read it, the chat is closed, and nobody else gains access. Run with Backend/scripts/test-db.sh.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists gone_tests;
grant usage on schema gone_tests to anon, authenticated, service_role;

create function gone_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function gone_tests.check_rejected(statement text, codes text[], description text)
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

create function gone_tests.sign_in(who uuid) returns void
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

grant execute on all functions in schema gone_tests to anon, authenticated, service_role;

-- Pia sells a lamp and deletes her account; Quin bought it. Rae asks about Sol's radio and
-- deletes her account; Sol keeps selling. Nan never took part. Tess asks about Uma's table, and
-- Uma later deletes the listing. Ada is an admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a300-00000000000a', 'pia-gone@test', '{"handle":"pia_gone"}'),
  ('00000000-0000-4000-a300-00000000000b', 'quin-gone@test', '{"handle":"quin_gone"}'),
  ('00000000-0000-4000-a300-00000000000c', 'rae-gone@test', '{"handle":"rae_gone"}'),
  ('00000000-0000-4000-a300-00000000000d', 'sol-gone@test', '{"handle":"sol_gone"}'),
  ('00000000-0000-4000-a300-00000000000e', 'nan-gone@test', '{"handle":"nan_gone"}'),
  ('00000000-0000-4000-a300-00000000000f', 'tess-gone@test', '{"handle":"tess_gone"}'),
  ('00000000-0000-4000-a300-000000000010', 'uma-gone@test', '{"handle":"uma_gone"}'),
  ('00000000-0000-4000-a300-000000000011', 'ada-gone@test', '{"handle":"ada_gone"}');
insert into public.admins (user_id) values ('00000000-0000-4000-a300-000000000011');

insert into public.listings (id, slug, seller_id, title, asking_php, moderation_status) values
  ('00000000-0000-4000-a310-00000000000a', 'gone-lamp', '00000000-0000-4000-a300-00000000000a',
   'Brass lamp', 1500, 'approved'),
  ('00000000-0000-4000-a310-00000000000b', 'gone-radio', '00000000-0000-4000-a300-00000000000d',
   'Transistor radio', 900, 'approved'),
  ('00000000-0000-4000-a310-00000000000c', 'gone-table', '00000000-0000-4000-a300-000000000010',
   'Side table', 2500, 'approved');

insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('00000000-0000-4000-a320-000000000001', '00000000-0000-4000-a310-00000000000a',
   '00000000-0000-4000-a300-00000000000b', '00000000-0000-4000-a300-00000000000a'),
  ('00000000-0000-4000-a320-000000000002', '00000000-0000-4000-a310-00000000000b',
   '00000000-0000-4000-a300-00000000000c', '00000000-0000-4000-a300-00000000000d'),
  ('00000000-0000-4000-a320-000000000003', '00000000-0000-4000-a310-00000000000c',
   '00000000-0000-4000-a300-00000000000f', '00000000-0000-4000-a300-000000000010');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-a320-000000000001', '00000000-0000-4000-a300-00000000000a'),
  ('00000000-0000-4000-a320-000000000001', '00000000-0000-4000-a300-00000000000b'),
  ('00000000-0000-4000-a320-000000000002', '00000000-0000-4000-a300-00000000000c'),
  ('00000000-0000-4000-a320-000000000002', '00000000-0000-4000-a300-00000000000d'),
  ('00000000-0000-4000-a320-000000000003', '00000000-0000-4000-a300-00000000000f'),
  ('00000000-0000-4000-a320-000000000003', '00000000-0000-4000-a300-000000000010');

insert into public.messages (id, conversation_id, sender_id, kind, body, offer_php, meetup_place, meetup_when) values
  ('00000000-0000-4000-a330-000000000001', '00000000-0000-4000-a320-000000000001',
   '00000000-0000-4000-a300-00000000000b', 'text', 'Is the lamp still here?', null, null, null),
  ('00000000-0000-4000-a330-000000000002', '00000000-0000-4000-a320-000000000001',
   '00000000-0000-4000-a300-00000000000a', 'text', 'Yes, come by anytime.', null, null, null),
  ('00000000-0000-4000-a330-000000000003', '00000000-0000-4000-a320-000000000001',
   '00000000-0000-4000-a300-00000000000a', 'offer', '', 1300, null, null),
  ('00000000-0000-4000-a330-000000000004', '00000000-0000-4000-a320-000000000001',
   '00000000-0000-4000-a300-00000000000a', 'meetup', '', null, 'SM Seaside', 'Today, 2:00 PM'),
  ('00000000-0000-4000-a330-000000000005', '00000000-0000-4000-a320-000000000002',
   '00000000-0000-4000-a300-00000000000c', 'text', 'Does the radio work?', null, null, null),
  ('00000000-0000-4000-a330-000000000006', '00000000-0000-4000-a320-000000000002',
   '00000000-0000-4000-a300-00000000000c', 'offer', '', 700, null, null),
  ('00000000-0000-4000-a330-000000000007', '00000000-0000-4000-a320-000000000003',
   '00000000-0000-4000-a300-00000000000f', 'text', 'Could you do 2,000?', null, null, null);
-- Everything above was sent in one instant; Quin and Sol had read nothing of what the other wrote.
update public.conversation_members set last_read_at = now() - interval '1 hour'
 where (conversation_id, user_id) in (
   ('00000000-0000-4000-a320-000000000001', '00000000-0000-4000-a300-00000000000b'),
   ('00000000-0000-4000-a320-000000000002', '00000000-0000-4000-a300-00000000000d'));
insert into public.conversation_reports (conversation_id, reporter_id, reason) values
  ('00000000-0000-4000-a320-000000000003', '00000000-0000-4000-a300-00000000000f', 'spam');

-- ---------------------------------------------------------------------------------------------
-- 1. Pia deletes her account (what delete-account does: delete the Auth user).
-- ---------------------------------------------------------------------------------------------

delete from auth.users where id = '00000000-0000-4000-a300-00000000000a';

set role authenticated;
select gone_tests.sign_in('00000000-0000-4000-a300-00000000000b');

select gone_tests.check(
  (select count(*) = 1
          and bool_and(other_id is null and other_handle is null and other_avatar_url is null)
          and bool_and(closed = 'deleted')
          and bool_and(not i_am_seller)
          and bool_and(listing_slug is null and listing_title = 'Deleted listing'
                       and asking_php is null)
          and bool_and(last_kind = 'meetup' and not last_from_me)
     from public.conversation_list()
    where id = '00000000-0000-4000-a320-000000000001'),
  'Quin still has the chat: the other person is empty, it is closed, and its listing is gone'
);
select gone_tests.check(
  (select unread_count = 3 from public.conversation_list('00000000-0000-4000-a320-000000000001')),
  'what the deleted person wrote still counts as unread for Quin'
);
select gone_tests.check(
  (select count(*) = 4 and count(*) filter (where sender_id is null) = 3
     from public.messages where conversation_id = '00000000-0000-4000-a320-000000000001'),
  'Quin can read the whole history; the deleted person''s messages are from nobody'
);
select gone_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, body)
    values ('00000000-0000-4000-a320-000000000001', 'text', 'Hello?')$$,
  array['SWCLO'],
  'Quin cannot send into the closed chat'
);
select gone_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, offer_php)
    values ('00000000-0000-4000-a320-000000000001', 'offer', 1000)$$,
  array['SWCLO'],
  'nor make an offer in it'
);
select gone_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-a330-000000000003', true)$$,
  array['SWCLO'],
  'nor accept the deleted person''s open offer'
);
select gone_tests.check_rejected(
  $$select public.confirm_meetup('00000000-0000-4000-a330-000000000004')$$,
  array['SWCLO'],
  'nor confirm the deleted person''s meetup'
);
select public.mark_conversation_read('00000000-0000-4000-a320-000000000001');
select gone_tests.check(
  (select unread_count = 0 from public.conversation_list('00000000-0000-4000-a320-000000000001')),
  'Quin can still mark it read'
);
insert into public.conversation_reports (conversation_id, reason)
values ('00000000-0000-4000-a320-000000000001', 'other');
select gone_tests.check(
  (select count(*) = 1 from public.conversation_reports
    where conversation_id = '00000000-0000-4000-a320-000000000001'),
  'Quin can still report the chat'
);
reset role;

-- Nobody else gains access.
set role authenticated;
select gone_tests.sign_in('00000000-0000-4000-a300-00000000000e');
select gone_tests.check(
  (select count(*) from public.conversation_list()) = 0
  and (select count(*) from public.conversation_list('00000000-0000-4000-a320-000000000001')) = 0
  and (select count(*) from public.conversations) = 0
  and (select count(*) from public.messages) = 0,
  'a stranger sees none of it'
);
select gone_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, body)
    values ('00000000-0000-4000-a320-000000000001', 'text', 'I am here too')$$,
  array['42501', 'SWCLO'],
  'a stranger cannot write into it, even though a side is now empty (refused as closed or by the row policy)'
);
select gone_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-a330-000000000003', true)$$,
  array['P0002'],
  'a stranger cannot answer its offer'
);
select gone_tests.check_rejected(
  $$select public.confirm_meetup('00000000-0000-4000-a330-000000000004')$$,
  array['P0002'],
  'nor confirm its meetup'
);
select gone_tests.check_rejected(
  $$update public.conversation_members set user_id = '00000000-0000-4000-a300-00000000000e'$$,
  array['42501'],
  'a stranger cannot make themselves a member'
);
reset role;
select gone_tests.check(
  not exists (select 1 from public.messages where body = 'I am here too')
  and (select count(*) from public.conversation_members
        where conversation_id = '00000000-0000-4000-a320-000000000001') = 1,
  'and nothing of the stranger was written; Quin is still the only one in it'
);
set role anon;
select gone_tests.sign_in(null);
select gone_tests.check_rejected(
  $$select count(*) from public.messages$$,
  array['42501'],
  'signed out, nothing is readable'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- 2. Rae deletes her account; Sol keeps the chat about his radio, and its listing.
-- ---------------------------------------------------------------------------------------------

delete from auth.users where id = '00000000-0000-4000-a300-00000000000c';

set role authenticated;
select gone_tests.sign_in('00000000-0000-4000-a300-00000000000d');
select gone_tests.check(
  (select other_id is null and closed = 'deleted' and i_am_seller
          and listing_slug = 'gone-radio' and listing_title = 'Transistor radio'
          and asking_php = 900 and last_kind = 'offer' and unread_count = 2
     from public.conversation_list('00000000-0000-4000-a320-000000000002')),
  'Sol keeps the chat with its listing, the other person empty, closed'
);
select gone_tests.check_rejected(
  $$select public.respond_to_offer('00000000-0000-4000-a330-000000000006', false)$$,
  array['SWCLO'],
  'Sol cannot answer the deleted buyer''s open offer'
);
select gone_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, body)
    values ('00000000-0000-4000-a320-000000000002', 'text', 'Still interested?')$$,
  array['SWCLO'],
  'nor message them'
);
select gone_tests.check(
  (select count(*) = 1 from public.listings where id = '00000000-0000-4000-a310-00000000000b'),
  'his listing is untouched'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- 3. A seller deletes a listing: the buyer's chat about it stays, archived, for both of them.
-- ---------------------------------------------------------------------------------------------

set role authenticated;
select gone_tests.sign_in('00000000-0000-4000-a300-000000000010');
delete from public.listings where id = '00000000-0000-4000-a310-00000000000c';
select gone_tests.check(
  (select closed = 'archived' and listing_slug is null and listing_title = 'Deleted listing'
          and other_handle = 'tess_gone'
     from public.conversation_list('00000000-0000-4000-a320-000000000003')),
  'Uma still has the chat about the listing she deleted, archived'
);
select gone_tests.sign_in('00000000-0000-4000-a300-00000000000f');
select gone_tests.check(
  (select closed = 'archived' and other_handle = 'uma_gone'
     from public.conversation_list('00000000-0000-4000-a320-000000000003'))
  and (select count(*) = 1 from public.messages
        where conversation_id = '00000000-0000-4000-a320-000000000003'),
  'and so does Tess, with her message'
);
select gone_tests.check_rejected(
  $$insert into public.messages (conversation_id, kind, body)
    values ('00000000-0000-4000-a320-000000000003', 'text', 'Hello?')$$,
  array['SWCLO'],
  'but nobody can write into it'
);
reset role;

-- The admin queue still lists a report on that chat.
set role authenticated;
select gone_tests.sign_in('00000000-0000-4000-a300-000000000011');
select gone_tests.check(
  exists (select 1 from public.admin_review_queue() q
           where q.kind = 'conversation' and q.target_id = '00000000-0000-4000-a320-000000000003'),
  'a report on a chat whose listing is gone is still a case for the admin'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- 4. The last person goes: the chat is deleted with them.
-- ---------------------------------------------------------------------------------------------

delete from auth.users where id = '00000000-0000-4000-a300-00000000000d';
select gone_tests.check(
  not exists (select 1 from public.conversations where id = '00000000-0000-4000-a320-000000000002')
  and not exists (select 1 from public.messages
                   where conversation_id = '00000000-0000-4000-a320-000000000002'),
  'when both people have gone, the chat is gone'
);
select gone_tests.check(
  exists (select 1 from public.conversations where id = '00000000-0000-4000-a320-000000000001'),
  'and a chat with someone left in it stays'
);

\echo 'All chat account-deletion tests passed.'
