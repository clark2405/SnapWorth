-- Fills in the public profile details people already gave. Until now Edit profile saved a name,
-- bio and place only to the account's own metadata (`auth.users.raw_user_meta_data`), never to
-- `public.profiles` (the columns `display_name`, `bio` and `location` that 20261110000200 added),
-- so seller pages showed just the handle. The app now writes them to `public.profiles`; this
-- copies what accounts already have so nobody has to save their profile again.
--
-- Upgrade-safe and one-time. It only fills a column that is still empty, so anything already on
-- the profile is kept, and running it again changes nothing. Values are trimmed and cut to the
-- columns' own limits (60, 280 and 80 characters) so a long or odd value can't make the
-- migration fail. Only strings count: metadata is whatever an account was given.
--
-- `handle_new_user` is replaced so an account created from now on starts with the same details
-- (a name chosen at sign-up, or the one Google supplies) instead of needing this again.

with details as (
  select u.id,
         nullif(left(btrim(case when jsonb_typeof(u.raw_user_meta_data -> 'full_name') = 'string'
                                then u.raw_user_meta_data ->> 'full_name' end), 60), '') as full_name,
         nullif(left(btrim(case when jsonb_typeof(u.raw_user_meta_data -> 'name') = 'string'
                                then u.raw_user_meta_data ->> 'name' end), 60), '') as name,
         nullif(left(btrim(case when jsonb_typeof(u.raw_user_meta_data -> 'bio') = 'string'
                                then u.raw_user_meta_data ->> 'bio' end), 280), '') as bio,
         nullif(left(btrim(case when jsonb_typeof(u.raw_user_meta_data -> 'location') = 'string'
                                then u.raw_user_meta_data ->> 'location' end), 80), '') as location
    from auth.users u
   where u.raw_user_meta_data is not null
)
update public.profiles p
   set display_name = case when p.display_name = '' then coalesce(d.full_name, d.name, '')
                           else p.display_name end,
       bio = case when p.bio = '' then coalesce(d.bio, '') else p.bio end,
       location = case when p.location = '' then coalesce(d.location, '') else p.location end
  from details d
 where d.id = p.id
   and ((p.display_name = '' and coalesce(d.full_name, d.name) is not null)
     or (p.bio = '' and d.bio is not null)
     or (p.location = '' and d.location is not null));

-- New accounts: the same details from the metadata they sign up with.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, handle, display_name, bio, location)
  values (
    new.id,
    coalesce(
      nullif(lower(new.raw_user_meta_data ->> 'handle'), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 10)
    ),
    coalesce(
      nullif(left(btrim(case when jsonb_typeof(meta -> 'full_name') = 'string'
                             then meta ->> 'full_name' end), 60), ''),
      nullif(left(btrim(case when jsonb_typeof(meta -> 'name') = 'string'
                             then meta ->> 'name' end), 60), ''),
      ''
    ),
    coalesce(nullif(left(btrim(case when jsonb_typeof(meta -> 'bio') = 'string'
                                    then meta ->> 'bio' end), 280), ''), ''),
    coalesce(nullif(left(btrim(case when jsonb_typeof(meta -> 'location') = 'string'
                                    then meta ->> 'location' end), 80), ''), '')
  );
  return new;
end;
$$;
