-- Behaviour tests for the Market: publishing listings from saved scans, scan photo visibility while
-- listed, editing and closing listings, seller profile fields, saved listings & price alerts, chat
-- compatibility, and flood limits. Run with Backend/scripts/test-db.sh.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists market_tests;
grant usage on schema market_tests to anon, authenticated, service_role;

create function market_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function market_tests.check_rejected(statement text, codes text[], description text)
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

create function market_tests.changed(statement text) returns integer
language plpgsql as $$
declare
  rows integer;
begin
  execute statement;
  get diagnostics rows = row_count;
  return rows;
end;
$$;

create function market_tests.sign_in(who uuid) returns void
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

grant execute on all functions in schema market_tests to anon, authenticated, service_role;

-- Maya (seller) and Noel (buyer).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-fa00-00000000000a', 'maya-market@test', '{"handle":"maya_sells"}'),
  ('00000000-0000-4000-fa00-00000000000b', 'noel-market@test', '{"handle":"noel_buys"}');

-- 1. Seller profile fields: Maya sets her display name, bio and location.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check(
  market_tests.changed($$update public.profiles
    set display_name = 'Maya Reyes',
        bio = 'Vintage cameras and denim around Lahug.',
        location = 'Cebu City'
    where id = '00000000-0000-4000-fa00-00000000000a'$$) = 1,
  'a seller updates their own display name, bio and location'
);
select market_tests.check(
  market_tests.changed($$update public.profiles
    set display_name = 'Hacked'
    where id = '00000000-0000-4000-fa00-00000000000b'$$) = 0,
  'nobody changes someone else''s seller profile details'
);
reset role;

-- 2. Maya saves a scan, uploads its photo, and lists it for sale.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
insert into public.scan_history (id, item_name, amount_php, low_php, high_php, paid_php)
values ('00000000-0000-4000-fb00-000000000001', 'Pentax K1000', 4200, 3600, 4800, 900);
insert into storage.objects (bucket_id, name)
values ('scan-photos', '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg');
update public.scan_history
   set photo_path = '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg'
 where id = '00000000-0000-4000-fb00-000000000001';

insert into public.listings (
  id,
  scan_id,
  title,
  asking_php,
  photo_path,
  category,
  condition,
  area,
  distance_km,
  description
)
values (
  '00000000-0000-4000-fc00-000000000001',
  '00000000-0000-4000-fb00-000000000001',
  '  Pentax K1000 35mm Camera  ',
  4500,
  '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg',
  'collectibles',
  'good',
  'cebu-city',
  3,
  '  Clean viewfinder, working light meter, 50mm f/2 lens included.  '
);

-- The AI estimate is copied from the scan by the database; a seller can't write or change it.
select market_tests.check(
  (select estimate_php = 4200 and estimate_low_php = 3600 and estimate_high_php = 4800
     from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'a listing takes its AI estimate and range from its scan'
);
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php, estimate_php)
    values ('Forged estimate', 1000, 99999)$$,
  array['42501'],
  'a seller cannot write the AI estimate when listing'
);
select market_tests.check_rejected(
  $$update public.listings set estimate_php = 99999, estimate_low_php = 90000, estimate_high_php = 100000
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['42501'],
  'a seller cannot change the AI estimate afterwards'
);
insert into public.listings (id, title, asking_php)
values ('00000000-0000-4000-fc00-000000000009', 'Loose find', 800);
select market_tests.check(
  (select estimate_php is null and estimate_low_php is null and estimate_high_php is null
     from public.listings where id = '00000000-0000-4000-fc00-000000000009'),
  'a listing with no scan has no AI estimate'
);
delete from public.listings where id = '00000000-0000-4000-fc00-000000000009';

select market_tests.check(
  (select title from public.listings where id = '00000000-0000-4000-fc00-000000000001')
    = 'Pentax K1000 35mm Camera'
  and (select slug from public.listings where id = '00000000-0000-4000-fc00-000000000001')
    = 'pentax-k1000-35mm-camera-00000000',
  'a published listing trims its text and builds a stable slug'
);

-- Forbidden inserts: someone else's scan, someone else's photo path, or setting verdict/saves_count.
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php, photo_path)
    values ('Loose photo', 1000, '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg')$$,
  array['23514'],
  'a listing photo path requires its matching scan_id'
);
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php, saves_count)
    values ('Boosted saves', 1000, 99)$$,
  array['42501'],
  'a seller cannot set saves_count directly'
);
reset role;

-- 3. Noel (and signed-out visitors) can now see the listing AND its scan photo in Storage,
--    and Noel can open a chat using the new listing's slug.
set role anon;
select market_tests.sign_in(null);
select market_tests.check(
  (select count(*) from storage.objects
    where bucket_id = 'scan-photos'
      and name = '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg') = 1,
  'a signed-out visitor can read a scan photo while a public listing points at it'
);
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php) values ('Anon item', 500)$$,
  array['42501'],
  'signed-out visitors cannot publish listings'
);
reset role;

set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000b');
select market_tests.check_rejected(
  $$insert into public.listings (scan_id, title, asking_php)
    values ('00000000-0000-4000-fb00-000000000001', 'Stolen scan', 2000)$$,
  array['23514'],
  'a buyer cannot list someone else''s scan'
);
select market_tests.check(
  public.start_conversation('pentax-k1000-35mm-camera-00000000') is not null,
  'a buyer can start a chat on a newly published listing by its slug'
);

-- 4. Noel saves the listing with a price-drop alert; saves_count on the listing goes up.
insert into public.saved_listings (listing_id, alert_below_php, alert_enabled)
values ('00000000-0000-4000-fc00-000000000001', 4050, true);

select market_tests.check(
  (select saves_count from public.listings where id = '00000000-0000-4000-fc00-000000000001') = 1,
  'saving a listing increments its saves_count'
);
select market_tests.check(
  market_tests.changed($$update public.saved_listings
    set alert_below_php = 3800, alert_enabled = false
    where listing_id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a buyer updates their own price-drop alert'
);
reset role;

-- Maya cannot see Noel's saved listings or price alerts.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check(
  (select count(*) from public.saved_listings) = 0,
  'another person''s saved listings and alerts are private'
);

-- 5. Maya edits her price, marks the listing sold, and later removes it; removing hides the scan
--    photo from everyone else again.
select market_tests.check(
  market_tests.changed($$update public.listings
    set asking_php = 4200, status = 'sold'
    where id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a seller updates their asking price and marks the listing sold'
);
select market_tests.check(
  market_tests.changed($$update public.listings
    set status = 'removed'
    where id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a seller can remove their listing'
);
reset role;

set role anon;
select market_tests.sign_in(null);
select market_tests.check(
  (select count(*) from storage.objects
    where bucket_id = 'scan-photos'
      and name = '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg') = 0,
  'removing a listing makes its scan photo private again'
);
reset role;

-- Noel unsaves the listing; saves_count drops back to 0.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000b');
delete from public.saved_listings where listing_id = '00000000-0000-4000-fc00-000000000001';
reset role;

select market_tests.check(
  (select saves_count from public.listings where id = '00000000-0000-4000-fc00-000000000001') = 0,
  'unsaving a listing decrements its saves_count'
);

-- 6. Flood limit: 20 listings an hour per seller.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
insert into public.listings (title, asking_php)
select 'Camera ' || n, 1000 + n from generate_series(1, 19) n;
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php) values ('One too many', 2000)$$,
  array['P0001'],
  'a 21st listing within an hour is refused'
);
reset role;

\echo 'All marketplace tests passed.'
