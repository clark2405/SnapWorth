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
  ('00000000-0000-4000-fa00-00000000000b', 'noel-market@test', '{"handle":"noel_buys"}'),
  ('00000000-0000-4000-fa00-00000000000c', 'cora-market@test', '{"handle":"cora_buys"}');

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
select market_tests.check(
  (select verdict is null and verdict_share is null
     from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'a new listing has no community verdict'
);
-- A seller's exact spot is never stored: coordinates are rounded to two decimals (about 1 km),
-- and there is no stored distance.
update public.listings set lat = 10.318456, lng = 123.890123
 where id = '00000000-0000-4000-fc00-000000000001';
select market_tests.check(
  (select lat = 10.32 and lng = 123.89 from public.listings
    where id = '00000000-0000-4000-fc00-000000000001'),
  'a listing''s coordinates are rounded to about 1 km'
);
select market_tests.check(
  not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'listings' and column_name = 'distance_km'
  ),
  'listings store no distance'
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

-- 2b. A new listing is pending moderation: only Maya sees it, and nobody else can open a chat
--     about it or read its photo. Held is the same; approved opens it up.
set role anon;
select market_tests.sign_in(null);
select market_tests.check(
  not exists (select 1 from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'a signed-out visitor cannot see a pending listing'
);
select market_tests.check(
  not exists (select 1 from storage.objects where bucket_id = 'scan-photos'
    and name = '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg'),
  'a pending listing''s scan photo is still private'
);
reset role;

set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000b');
select market_tests.check(
  not exists (select 1 from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'another signed-in person cannot see a pending listing'
);
select market_tests.check_rejected(
  $$select public.start_conversation('pentax-k1000-35mm-camera-00000000')$$,
  array['P0002'],
  'nobody can open a chat about a listing that is not approved'
);
reset role;

set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check(
  (select moderation_status = 'pending' from public.listings
    where id = '00000000-0000-4000-fc00-000000000001'),
  'the seller sees their own pending listing, with its state'
);
select market_tests.check_rejected(
  $$update public.listings set moderation_status = 'approved'
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['42501'],
  'a seller cannot approve their own listing'
);
select market_tests.check_rejected(
  $$insert into public.listings (title, asking_php, moderation_status)
    values ('Self-approved', 1000, 'approved')$$,
  array['42501'],
  'a seller cannot publish a listing already approved'
);
select market_tests.check_rejected(
  $$insert into public.listings (slug, title, asking_php)
    values ('chosen-slug', 'Chosen slug', 1000)$$,
  array['42501'],
  'a seller cannot choose their own slug'
);
reset role;

update public.listings set moderation_status = 'held', moderation_ref = 'rules (link)',
       moderated_at = now()
 where id = '00000000-0000-4000-fc00-000000000001';
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check(
  (select moderation_status = 'held' from public.listings
    where id = '00000000-0000-4000-fc00-000000000001'),
  'the seller sees their held listing, with its state'
);
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000b');
select market_tests.check(
  not exists (select 1 from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'a held listing is not public'
);
reset role;

update public.listings set moderation_status = 'approved', moderation_ref = 'rules',
       moderated_at = now()
 where id = '00000000-0000-4000-fc00-000000000001';

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
select market_tests.check(
  public.start_conversation('00000000-0000-4000-fc00-000000000001')
    = public.start_conversation('pentax-k1000-35mm-camera-00000000'),
  'the same chat opens from the listing''s id as from its slug'
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

-- 4a. The statements the app sends to save a listing or set an alert. They are an update, then an
--     insert when nothing changed, and never carry `user_id`. A PostgREST upsert is refused (even
--     for a first save), because ON CONFLICT DO UPDATE needs UPDATE privilege on every column it
--     sends and the grants (insert: listing_id, alert_below_php, alert_enabled; update:
--     alert_below_php, alert_enabled) don't let anyone rewrite `listing_id` or `user_id`.
--     Keep those grants as they are: the app works with them.
select market_tests.check_rejected(
  $$insert into public.saved_listings (listing_id, alert_below_php, alert_enabled)
    values ('00000000-0000-4000-fc00-000000000001', 3900, true)
    on conflict (user_id, listing_id) do update set
      listing_id = excluded.listing_id,
      alert_below_php = excluded.alert_below_php,
      alert_enabled = excluded.alert_enabled$$,
  array['42501'],
  'the old upsert shape is refused: it would rewrite listing_id on a conflict'
);
select market_tests.check(
  market_tests.changed($$delete from public.saved_listings
    where listing_id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a buyer unsaves their own listing'
);
select market_tests.check_rejected(
  $$insert into public.saved_listings (listing_id, alert_below_php, alert_enabled)
    values ('00000000-0000-4000-fc00-000000000001', 3900, true)
    on conflict (user_id, listing_id) do update set
      listing_id = excluded.listing_id,
      alert_below_php = excluded.alert_below_php,
      alert_enabled = excluded.alert_enabled$$,
  array['42501'],
  'the old upsert shape is refused even when there is no row to conflict with'
);
select market_tests.check(
  market_tests.changed($$update public.saved_listings
    set alert_below_php = 3900, alert_enabled = true
    where listing_id = '00000000-0000-4000-fc00-000000000001'$$) = 0,
  'the app first updates: nothing changes for a listing that is not saved yet'
);
select market_tests.check(
  market_tests.changed($$insert into public.saved_listings (listing_id, alert_below_php, alert_enabled)
    values ('00000000-0000-4000-fc00-000000000001', 3900, true)$$) = 1,
  'then it inserts the save, with no user_id'
);
select market_tests.check(
  (select user_id = '00000000-0000-4000-fa00-00000000000b' and alert_below_php = 3900
     from public.saved_listings
    where listing_id = '00000000-0000-4000-fc00-000000000001'),
  'the save belongs to the caller by default'
);
select market_tests.check(
  market_tests.changed($$update public.saved_listings
    set alert_below_php = 3800, alert_enabled = false
    where listing_id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'saving it again updates the alert in place'
);
select market_tests.check(
  (select count(*) = 1 and bool_and(alert_below_php = 3800 and not alert_enabled)
     from public.saved_listings
    where listing_id = '00000000-0000-4000-fc00-000000000001'),
  'there is still one save, with the new alert'
);
reset role;

-- Maya cannot see Noel's saved listings or price alerts.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check(
  (select count(*) from public.saved_listings) = 0,
  'another person''s saved listings and alerts are private'
);

-- 4b. Maya reword her title: the listing goes back to pending (hidden from the public and its
--     photo) until it is screened again. Noel, who is already chatting about it, still sees it,
--     and nobody new can start a chat.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
update public.listings set asking_php = 4400
 where id = '00000000-0000-4000-fc00-000000000001';
select market_tests.check(
  (select moderation_status = 'approved' from public.listings
    where id = '00000000-0000-4000-fc00-000000000001'),
  'changing the price alone does not send a listing back to moderation'
);
update public.listings set title = 'Pentax K1000 35mm Film Camera'
 where id = '00000000-0000-4000-fc00-000000000001';
select market_tests.check(
  (select moderation_status = 'pending' and moderation_ref is null
          and moderated_at > now() - interval '1 minute'
     from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'changing the title sends a listing back to pending, stamped with when it went back in line'
);
reset role;

set role anon;
select market_tests.sign_in(null);
select market_tests.check(
  not exists (select 1 from public.listings where id = '00000000-0000-4000-fc00-000000000001')
  and not exists (select 1 from storage.objects where bucket_id = 'scan-photos'
    and name = '00000000-0000-4000-fa00-00000000000a/00000000-0000-4000-fb00-000000000001.jpg'),
  'an edited listing and its photo leave the public view until re-screened'
);
reset role;

set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000b');
select market_tests.check(
  exists (select 1 from public.listings where id = '00000000-0000-4000-fc00-000000000001'),
  'someone already chatting about a listing keeps seeing it while it is re-screened'
);
select market_tests.check(
  public.start_conversation('pentax-k1000-35mm-camera-00000000')
    = (select id from public.conversations
        where listing_id = '00000000-0000-4000-fc00-000000000001'
          and buyer_id = '00000000-0000-4000-fa00-00000000000b'),
  'an existing chat can still be reopened while the listing is re-screened'
);
reset role;

update public.listings set moderation_status = 'approved', moderation_ref = 'rules',
       moderated_at = now()
 where id = '00000000-0000-4000-fc00-000000000001';

-- 5. Maya edits her price, marks the listing sold, and later removes it; removing hides the scan
--    photo from everyone else again.
select market_tests.check(
  market_tests.changed($$update public.listings
    set asking_php = 4200, status = 'sold'
    where id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a seller updates their asking price and marks the listing sold'
);
reset role;
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000c');
select market_tests.check_rejected(
  $$select public.start_conversation('pentax-k1000-35mm-camera-00000000')$$,
  array['SWCLO'],
  'a new buyer cannot start a chat on a listing that has sold'
);
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
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

-- 5b. A seller can't rewrite a listing's identity or server-owned columns after creating it.
--     The column grants already refuse the update; widen them on purpose here to show the guard
--     trigger would refuse it on its own.
set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check_rejected(
  $$update public.listings set scan_id = null
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['42501'],
  'the grants refuse a change to scan_id'
);
reset role;

grant update (scan_id, photo_path, seller_id, slug, created_at, estimate_php, estimate_low_php,
  estimate_high_php, verdict, verdict_share, moderation_status, moderation_ref, moderated_at,
  views_count, saves_count) on public.listings to authenticated;

set role authenticated;
select market_tests.sign_in('00000000-0000-4000-fa00-00000000000a');
select market_tests.check_rejected(
  $$update public.listings set scan_id = null where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot detach or swap the scan');
select market_tests.check_rejected(
  $$update public.listings set photo_path = null where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the photo');
select market_tests.check_rejected(
  $$update public.listings set seller_id = '00000000-0000-4000-fa00-00000000000b'
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot hand the listing to someone else');
select market_tests.check_rejected(
  $$update public.listings set slug = 'something-else-00000000' where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the slug');
select market_tests.check_rejected(
  $$update public.listings set created_at = now() - interval '5 years'
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot back-date the listing');
select market_tests.check_rejected(
  $$update public.listings set estimate_php = 1, estimate_low_php = 1, estimate_high_php = 1
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the AI estimate');
select market_tests.check_rejected(
  $$update public.listings set verdict = 'too_low', verdict_share = 99
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the community verdict');
select market_tests.check_rejected(
  $$update public.listings set moderation_status = 'held'
     where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the moderation state');
select market_tests.check_rejected(
  $$update public.listings set saves_count = 500 where id = '00000000-0000-4000-fc00-000000000001'$$,
  array['SWIMM'], 'a seller cannot change the save count');
-- What the seller may still change goes through.
select market_tests.check(
  market_tests.changed($$update public.listings set condition = 'fair', description = 'Tested again.'
    where id = '00000000-0000-4000-fc00-000000000001'$$) = 1,
  'a seller can still edit what is theirs to edit'
);
reset role;

revoke update (scan_id, photo_path, seller_id, slug, created_at, estimate_php, estimate_low_php,
  estimate_high_php, verdict, verdict_share, moderation_status, moderation_ref, moderated_at,
  views_count, saves_count) on public.listings from authenticated;

-- The service role (no client role) can still settle moderation, and the saves trigger still counts.
update public.listings set moderation_status = 'approved', moderation_ref = 'rules',
       moderated_at = now()
 where id = '00000000-0000-4000-fc00-000000000001';

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
