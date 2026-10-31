-- People can change their own handle from Edit profile. Until now `public.profiles` was read-only
-- to the app, so a new handle was kept on the account but never reached the profile that
-- comments and chats show.
--
-- Only the handle. The photo stays on the account for now: a picked photo is a path on the
-- phone that nobody else can open, so it needs uploading to Storage before it belongs here.
-- The handle keeps its existing rules: unique, and 3-24 lowercase letters, digits or underscores.

grant update (handle) on public.profiles to authenticated;

create policy "People change their own handle"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
