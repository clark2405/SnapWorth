-- Photos in Supabase Storage: each saved scan's photo, and each person's profile photo. Until
-- now both were paths on the phone that took them, so nobody else, and no other device, could
-- open them.
--
-- Two buckets, with different rules for who may look:
--
-- * `avatars` is public. A profile photo is shown beside every comment, chat and hanap post,
--   including to signed-out visitors, so it's read through the bucket's public URL. Each person
--   has one photo, `<user id>/avatar.<jpg|png|webp>`, and the app adds `?v=<time>` to the URL so
--   a new photo isn't hidden behind a cached old one.
--
-- * `scan-photos` is private: only the owner can read a scan's photo, through a signed link the
--   app asks for (`createSignedUrl(s)`), good for a limited time. Scan photos are often taken at
--   home, of things nobody else has been shown yet.
--
--   Considered and not chosen: a public bucket with unguessable paths. It's simpler (no signing,
--   links that never expire and cache well), but a link that leaks, or is seen once in a listing
--   that is later taken down, works for ever, and can't be withdrawn short of deleting the photo.
--   The cost of the private bucket is a round trip for fresh links on each load of History, and
--   fewer cache hits, since each link is new.
--
--   When a scan is listed or posted (the Market and Feed work), its photo has to be seen by
--   everyone. That work adds one more `select` policy on `storage.objects` for `anon` and
--   `authenticated`: a `scan-photos` object is readable when a public listing or post points at
--   it. Policies are OR'd, so the owner-only rule below stays as it is, and taking the listing
--   down makes the photo private again. Viewers then get signed links the same way the owner does.
--
-- Writing is the same in both: a person adds, replaces and deletes only inside their own
-- `<user id>/` folder, and only the names the app uses, which also limits how much each person can
-- store: one photo per saved scan (and scans are limited to 60 an hour), and one profile photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('scan-photos', 'scan-photos', false, 5242880, array['image/jpeg']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------------------
-- Scan photos: `<user id>/<scan id>.jpg`, for a scan the person has saved.
-- ---------------------------------------------------------------------------------------------

-- Where the scan's photo is in `scan-photos`, once it's uploaded. Always the owner's folder and
-- the scan's own name, so a scan can't point at someone else's photo. `photo_uri` stays: it's
-- where the photo is on the phone that took it, shown there while the upload is on its way.
alter table public.scan_history
  add column photo_path text,
  add constraint scan_history_photo_path_check
    check (photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg');

comment on column public.scan_history.photo_path is
  'The scan''s photo in the private scan-photos bucket, once uploaded.';

-- The photo goes up after the scan is saved, so its path is set by an update.
grant update (photo_path) on public.scan_history to authenticated;

create policy "People upload photos of their own scans"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.scan_history s
       where s.user_id = (select auth.uid())
         and storage.objects.name = s.user_id::text || '/' || s.id::text || '.jpg'
    )
  );

create policy "People see their own scan photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- An upload that's tried again replaces the first attempt.
create policy "People replace their own scan photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.scan_history s
       where s.user_id = (select auth.uid())
         and storage.objects.name = s.user_id::text || '/' || s.id::text || '.jpg'
    )
  );

create policy "People delete their own scan photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------------------------
-- Profile photos: `<user id>/avatar.<jpg|png|webp>`, public to read.
-- ---------------------------------------------------------------------------------------------

create policy "People upload their own profile photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );

-- Everyone reads profile photos through the public URL, which doesn't ask these policies. This
-- one lets the owner replace theirs (an upsert reads before it writes) without letting anyone
-- list other people's folders.
create policy "People see their own profile photo files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "People replace their own profile photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );

create policy "People delete their own profile photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------------------------
-- `profiles.avatar_url`: set by its owner, to their own uploaded photo only.
-- ---------------------------------------------------------------------------------------------

-- A person may now point their profile at their photo. The URL must be this project's public
-- URL for a photo in their own avatar folder that's really there:
--
--   <project URL>/storage/v1/object/public/avatars/<their id>/avatar.<jpg|png|webp>[?v=<digits>]
--
-- The project URL is taken from the caller's sign-in token (its `iss` is `<project URL>/auth/v1`),
-- so the photo can't be served from another site that could watch who looks at it. Locally that
-- means the app must use the same address the Supabase CLI prints (http://127.0.0.1:54321).
-- Without a signed-in caller (the service role, seeds), anything goes. It runs as the caller, so
-- it finds the photo through the owner's own "see their own profile photo files" policy.
create function public.check_avatar_url()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project text := regexp_replace(coalesce(auth.jwt() ->> 'iss', ''), '/auth/v1/?$', '');
  prefix text := project || '/storage/v1/object/public/avatars/' || new.id::text || '/avatar.';
  rest text;
begin
  if (select auth.uid()) is null or new.avatar_url is null
     or new.avatar_url is not distinct from old.avatar_url then
    return new;
  end if;
  rest := substr(new.avatar_url, length(prefix) + 1);
  if project = ''
     or left(new.avatar_url, length(prefix)) <> prefix
     or rest !~ '^(jpg|png|webp)(\?v=[0-9]{1,20})?$'
     or not exists (
       select 1
         from storage.objects o
        where o.bucket_id = 'avatars'
          and o.name = new.id::text || '/avatar.' || split_part(rest, '?', 1)
     ) then
    raise exception 'A profile photo has to be one you uploaded to your own avatar folder.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_check_avatar_url
  before update of avatar_url on public.profiles
  for each row execute function public.check_avatar_url();

-- The existing "People change their own handle" policy already limits updates to one's own row;
-- the column grant is what lets the photo through it.
grant update (avatar_url) on public.profiles to authenticated;
