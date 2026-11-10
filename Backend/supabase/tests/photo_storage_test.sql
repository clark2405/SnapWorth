-- Behaviour tests for photos in Storage: scan photos are private to their owner, profile photos
-- are public, and each person writes only inside their own folder. Run with
-- Backend/scripts/test-db.sh (local Postgres + the auth and Storage stubs). Each check raises on
-- failure. The Storage API writes and reads `storage.objects` as the caller's role, so these
-- tests do the same.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema if not exists photo_tests;
grant usage on schema photo_tests to anon, authenticated, service_role;

create function photo_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function photo_tests.check_rejected(statement text, codes text[], description text)
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

-- Counts the rows a statement changed, since row-level security skips others' silently.
create function photo_tests.changed(statement text) returns integer
language plpgsql as $$
declare
  rows integer;
begin
  execute statement;
  get diagnostics rows = row_count;
  return rows;
end;
$$;

-- Signs in as someone, the way a request through the API would: their id and the project's
-- sign-in address in the token's claims. `null` signs out.
create function photo_tests.sign_in(who uuid) returns void
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

grant execute on all functions in schema photo_tests to anon, authenticated, service_role;

-- Sam and Tess each snap things and have a profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-d500-00000000000a', 'sam-photos@test', '{"handle":"sam_photos"}'),
  ('00000000-0000-4000-d500-00000000000b', 'tess-photos@test', '{"handle":"tess_photos"}');

-- 0. The buckets: profile photos public, scan photos not.
select photo_tests.check(
  (select public from storage.buckets where id = 'avatars'),
  'profile photos are in a public bucket'
);
select photo_tests.check(
  not (select public from storage.buckets where id = 'scan-photos'),
  'scan photos are in a private bucket'
);

-- 1. Sam saves a scan and uploads its photo.
set role authenticated;
select photo_tests.sign_in('00000000-0000-4000-d500-00000000000a');
insert into public.scan_history (id, item_name, amount_php, low_php, high_php)
values ('00000000-0000-4000-d600-000000000001', 'Walkman', 1900, 1600, 2200);
insert into storage.objects (bucket_id, name)
values ('scan-photos', '00000000-0000-4000-d500-00000000000a/00000000-0000-4000-d600-000000000001.jpg');
select photo_tests.check(
  photo_tests.changed($$update public.scan_history
    set photo_path = '00000000-0000-4000-d500-00000000000a/00000000-0000-4000-d600-000000000001.jpg'
    where id = '00000000-0000-4000-d600-000000000001'$$) = 1,
  'an owner records where their scan''s photo is'
);
select photo_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 1,
  'an owner sees their own scan photo'
);
select photo_tests.check_rejected(
  $$update public.scan_history
    set photo_path = '00000000-0000-4000-d500-00000000000b/00000000-0000-4000-d600-000000000001.jpg'
    where id = '00000000-0000-4000-d600-000000000001'$$,
  array['23514'],
  'a scan can''t point at a photo in someone else''s folder'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('scan-photos', '00000000-0000-4000-d500-00000000000a/anything.jpg')$$,
  array['42501'],
  'a scan photo needs a saved scan of the same name'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('scan-photos', '00000000-0000-4000-d500-00000000000b/00000000-0000-4000-d600-000000000001.jpg')$$,
  array['42501'],
  'nobody uploads into someone else''s folder'
);
select photo_tests.check(
  photo_tests.changed($$update storage.objects set metadata = '{"size": 1}'
    where name = '00000000-0000-4000-d500-00000000000a/00000000-0000-4000-d600-000000000001.jpg'$$) = 1,
  'an owner can replace their scan photo, as a retried upload does'
);
reset role;

-- 2. Tess can't see, replace or delete Sam's scan photo, or upload one for his scan.
set role authenticated;
select photo_tests.sign_in('00000000-0000-4000-d500-00000000000b');
select photo_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 0,
  'someone else''s scan photos can''t be seen'
);
select photo_tests.check(
  photo_tests.changed($$update storage.objects set metadata = '{}'
    where bucket_id = 'scan-photos'$$) = 0,
  'someone else''s scan photo can''t be replaced'
);
select photo_tests.check(
  photo_tests.changed($$delete from storage.objects where bucket_id = 'scan-photos'$$) = 0,
  'someone else''s scan photo can''t be deleted'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('scan-photos', '00000000-0000-4000-d500-00000000000b/00000000-0000-4000-d600-000000000001.jpg')$$,
  array['42501'],
  'nobody uploads a photo for someone else''s scan, even into their own folder'
);
reset role;

-- 3. Signed out, scan photos can't be seen or added.
set role anon;
select photo_tests.sign_in(null);
select photo_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 0,
  'a signed-out visitor can''t see scan photos'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('scan-photos', '00000000-0000-4000-d500-00000000000a/00000000-0000-4000-d600-000000000002.jpg')$$,
  array['42501'],
  'a signed-out visitor can''t upload a scan photo'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-4000-d500-00000000000a/avatar.jpg')$$,
  array['42501'],
  'a signed-out visitor can''t upload a profile photo'
);
reset role;

-- 4. Sam uploads his profile photo, under its one name, and points his profile at it.
set role authenticated;
select photo_tests.sign_in('00000000-0000-4000-d500-00000000000a');
insert into storage.objects (bucket_id, name)
values ('avatars', '00000000-0000-4000-d500-00000000000a/avatar.jpg');
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-4000-d500-00000000000a/holiday.jpg')$$,
  array['42501'],
  'a profile photo has one name, so nobody stores a pile of files'
);
select photo_tests.check_rejected(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-4000-d500-00000000000b/avatar.jpg')$$,
  array['42501'],
  'nobody uploads someone else''s profile photo'
);
select photo_tests.check(
  photo_tests.changed($$update public.profiles
    set avatar_url = 'https://snapworth.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000a/avatar.jpg?v=1731240000000'
    where id = '00000000-0000-4000-d500-00000000000a'$$) = 1,
  'a person points their profile at the photo they uploaded'
);
select photo_tests.check_rejected(
  $$update public.profiles set avatar_url = 'https://example.com/me.png'
    where id = '00000000-0000-4000-d500-00000000000a'$$,
  array['23514'],
  'a photo from elsewhere on the web is refused'
);
select photo_tests.check_rejected(
  $$update public.profiles
    set avatar_url = 'https://tracker.example/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000a/avatar.jpg'
    where id = '00000000-0000-4000-d500-00000000000a'$$,
  array['23514'],
  'the same path on another site is refused'
);
select photo_tests.check_rejected(
  $$update public.profiles
    set avatar_url = 'https://snapworth.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000b/avatar.jpg'
    where id = '00000000-0000-4000-d500-00000000000a'$$,
  array['23514'],
  'someone else''s profile photo is refused'
);
select photo_tests.check_rejected(
  $$update public.profiles
    set avatar_url = 'https://snapworth.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000a/avatar.png'
    where id = '00000000-0000-4000-d500-00000000000a'$$,
  array['23514'],
  'a photo that was never uploaded is refused'
);
select photo_tests.check(
  photo_tests.changed($$update public.profiles
    set avatar_url = 'https://snapworth.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000b/avatar.jpg'
    where id = '00000000-0000-4000-d500-00000000000b'$$) = 0,
  'nobody changes someone else''s profile photo'
);
reset role;

-- 5. Tess can't delete or replace Sam's profile photo; nobody signed out changes a profile's.
set role authenticated;
select photo_tests.sign_in('00000000-0000-4000-d500-00000000000b');
select photo_tests.check(
  photo_tests.changed($$delete from storage.objects where bucket_id = 'avatars'$$) = 0,
  'someone else''s profile photo can''t be deleted'
);
select photo_tests.check(
  photo_tests.changed($$update storage.objects set metadata = '{}' where bucket_id = 'avatars'$$) = 0,
  'someone else''s profile photo can''t be replaced'
);
reset role;

set role anon;
select photo_tests.sign_in(null);
select photo_tests.check_rejected(
  $$update public.profiles set avatar_url = null
    where id = '00000000-0000-4000-d500-00000000000a'$$,
  array['42501'],
  'a signed-out visitor can''t change any profile photo'
);
reset role;

select photo_tests.check(
  (select avatar_url from public.profiles where id = '00000000-0000-4000-d500-00000000000a')
    like 'https://snapworth.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-d500-00000000000a/avatar.jpg?v=%',
  'Sam''s profile photo is the one he set'
);

-- 6. Sam deletes his scan photo.
set role authenticated;
select photo_tests.sign_in('00000000-0000-4000-d500-00000000000a');
select photo_tests.check(
  photo_tests.changed($$delete from storage.objects where bucket_id = 'scan-photos'$$) = 1,
  'an owner can delete their scan photo'
);
reset role;

\echo 'All photo storage tests passed.'
