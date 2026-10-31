-- Behaviour tests for suki discounts: only a seller sets one, only for a buyer they've chatted
-- with, and only the two of them see it. Run with Backend/scripts/test-db.sh (local Postgres +
-- auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists suki_tests;
grant usage on schema suki_tests to anon, authenticated, service_role;

create function suki_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function suki_tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema suki_tests to anon, authenticated, service_role;

-- Sela sells; Bea has messaged her about a listing; Cora never has.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-f000-00000000000a', 'sela@test', '{"handle":"sela"}'),
  ('00000000-0000-4000-f000-00000000000b', 'bea@test', '{"handle":"bea_suki"}'),
  ('00000000-0000-4000-f000-00000000000c', 'cora@test', '{"handle":"cora"}');
insert into public.listings (id, slug, seller_id, title, asking_php)
values ('00000000-0000-4000-f100-000000000001', 'sela-lamp',
        '00000000-0000-4000-f000-00000000000a', 'Brass lamp', 1500);
insert into public.conversations (id, listing_id, buyer_id, seller_id)
values ('00000000-0000-4000-f200-000000000001', '00000000-0000-4000-f100-000000000001',
        '00000000-0000-4000-f000-00000000000b', '00000000-0000-4000-f000-00000000000a');
-- Both are members, as when the app starts a chat.
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-f200-000000000001', '00000000-0000-4000-f000-00000000000a'),
  ('00000000-0000-4000-f200-000000000001', '00000000-0000-4000-f000-00000000000b');

-- 1. Sela makes Bea her suki.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-f000-00000000000a', false);
insert into public.suki_discounts (buyer_id, discount_pct)
values ('00000000-0000-4000-f000-00000000000b', 10);
select suki_tests.check(
  (select seller_id from public.suki_discounts) = '00000000-0000-4000-f000-00000000000a',
  'a suki discount belongs to the seller who set it'
);
select suki_tests.check_rejected(
  $$insert into public.suki_discounts (buyer_id, discount_pct)
    values ('00000000-0000-4000-f000-00000000000c', 10)$$,
  array['42501'],
  'a seller cannot make a stranger their suki'
);
-- The app changes a discount with a plain update of the rate.
update public.suki_discounts set discount_pct = 15
 where seller_id = '00000000-0000-4000-f000-00000000000a'
   and buyer_id = '00000000-0000-4000-f000-00000000000b';
select suki_tests.check(
  (select count(*) = 1 and min(discount_pct) = 15 from public.suki_discounts),
  'a seller can change their suki''s discount'
);
-- An upsert would also set the buyer, which isn't allowed, so the app never sends one.
select suki_tests.check_rejected(
  $$insert into public.suki_discounts (buyer_id, discount_pct)
    values ('00000000-0000-4000-f000-00000000000b', 20)
    on conflict (seller_id, buyer_id) do update
      set buyer_id = excluded.buyer_id, discount_pct = excluded.discount_pct$$,
  array['42501'],
  'a suki can''t be moved to another buyer, even by an upsert'
);
select suki_tests.check_rejected(
  $$update public.suki_discounts set discount_pct = 80$$,
  array['23514'],
  'a suki discount stays at or under half'
);
update public.suki_discounts set discount_pct = 15;
select suki_tests.check(
  (select discount_pct from public.suki_discounts) = 15,
  'a seller can change their suki discount'
);

-- 2. Bea sees it but can't change it; Cora can't see it.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-f000-00000000000b', false);
select suki_tests.check(
  (select discount_pct from public.suki_discounts) = 15,
  'the buyer sees their suki discount'
);
update public.suki_discounts set discount_pct = 50;
select suki_tests.check(
  (select discount_pct from public.suki_discounts) = 15,
  'the buyer cannot change their own discount'
);
select suki_tests.check_rejected(
  $$insert into public.suki_discounts (seller_id, buyer_id, discount_pct)
    values ('00000000-0000-4000-f000-00000000000a', '00000000-0000-4000-f000-00000000000b', 50)$$,
  array['42501'],
  'nobody can set a discount on a seller''s behalf'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-f000-00000000000c', false);
select suki_tests.check(
  (select count(*) from public.suki_discounts) = 0,
  'someone else cannot see the discount'
);
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false); -- signed out: nobody's id
select suki_tests.check_rejected(
  $$select count(*) from public.suki_discounts$$,
  array['42501'],
  'signed-out visitors cannot see suki discounts'
);
reset role;

-- 3. Sela ends it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-f000-00000000000a', false);
delete from public.suki_discounts;
select suki_tests.check(
  (select count(*) from public.suki_discounts) = 0,
  'a seller can end a suki'
);
reset role;

\echo 'All suki tests passed.'
