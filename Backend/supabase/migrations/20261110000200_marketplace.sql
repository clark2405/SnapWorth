-- Market: real listings, seller profile details, saved listings with price-drop alerts, and
-- public read access to a scan's photo while a public listing points at it.
--
-- * Never copy `scan_history.paid_php` onto a listing: what the seller paid is private to them.
-- * A listing's `asking_php` is always entered by the seller. `estimate_php`, `estimate_low_php`
--   and `estimate_high_php` are the AI valuation shown beside it, so a seller must not be able to
--   write them: `prepare_listing` copies them from the linked `scan_history` row (the app's own
--   estimate for that photo) and leaves them null when the listing has no scan. They are not in
--   any column grant. Only a caller with no signed-in user (the service role, a seed) can set them.
-- * `slug` is the stable public key in `/listing/[id]` links and in `start_conversation`. For a
--   signed-in seller it is always generated here (never chosen by the client), so one listing's
--   slug can't be made to look like another's id. `start_conversation` also takes the id.
-- * A listing is public text, so it is moderated like a Hanap post or a feed post: it starts
--   `pending`, only its seller sees it until `moderate-content` marks it `approved`, and changing
--   its title or description sends it back to `pending` to be screened again. Only approved,
--   not-removed listings are public, can be messaged, or share their scan photo.

-- ---------------------------------------------------------------------------------------------
-- Seller profile fields on `public.profiles`
-- ---------------------------------------------------------------------------------------------

alter table public.profiles
  add column display_name text not null default '' check (char_length(display_name) <= 60),
  add column bio text not null default '' check (char_length(bio) <= 280),
  add column location text not null default '' check (char_length(location) <= 80);

comment on column public.profiles.display_name is 'Public display name shown on profile and seller pages.';
comment on column public.profiles.bio is 'Short public bio shown on profile and seller pages.';
comment on column public.profiles.location is 'Neighbourhood or city shown on profile and seller pages.';

grant update (display_name, bio, location) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Expand `public.listings` for the full Market experience
-- ---------------------------------------------------------------------------------------------

alter table public.listings
  alter column seller_id set default auth.uid(),
  add column scan_id uuid references public.scan_history (id) on delete set null,
  add column photo_path text,
  add column category text not null default 'collectibles'
    check (category in ('collectibles', 'fashion', 'sneakers', 'electronics', 'home')),
  add column condition text not null default 'good'
    check (condition in ('new', 'like_new', 'good', 'fair')),
  add column area text not null default 'cebu-city'
    check (area in ('cebu-city', 'mandaue', 'lapu-lapu', 'metro-manila')),
  -- Where the listing is, only roughly: `prepare_listing` rounds both to two decimals (about
  -- 1 km), so a seller's exact spot is never stored. When they are null the app places the listing
  -- at its `area`'s centre. A buyer's "near me" distance is worked out on their own device from
  -- these and their own position; there is no stored distance, which could only be a guess made
  -- for a viewer nobody knows yet.
  add column lat double precision check (lat is null or lat between 4.5 and 21.5),
  add column lng double precision check (lng is null or lng between 116.0 and 127.0),
  add column description text not null default ''
    check (char_length(description) <= 1000),
  add column estimate_php integer check (estimate_php is null or estimate_php >= 0),
  add column estimate_low_php integer check (estimate_low_php is null or estimate_low_php >= 0),
  add column estimate_high_php integer
    check (estimate_high_php is null or (estimate_low_php is not null and estimate_high_php >= estimate_low_php)),
  -- The community's verdict on the asking price. Null until people have voted on a post that
  -- reposts this listing; `refresh_listing_verdict` (feed_and_votes) sets it and clears it again
  -- if the votes go. Never client-writable: it is in no column grant.
  add column verdict text check (verdict in ('too_high', 'just_right', 'too_low')),
  add column verdict_share integer check (verdict_share between 0 and 100),
  -- 'approved' only for the rows that already exist, which were public under the old rule; the
  -- default is switched to 'pending' right after, so every new listing starts unscreened.
  add column moderation_status public.moderation_status not null default 'approved',
  add column moderation_ref text,
  add column moderated_at timestamptz,
  add column views_count integer not null default 0 check (views_count >= 0),
  add column saves_count integer not null default 0 check (saves_count >= 0),
  add constraint listings_verdict_pair_check check ((verdict is null) = (verdict_share is null)),
  add constraint listings_photo_path_check
    check (
      photo_path is null
      or (scan_id is not null and photo_path = seller_id::text || '/' || scan_id::text || '.jpg')
    );

-- Backfill for a database that already has listings (the live project's seeded ones). Until now
-- every listing that wasn't removed was public and could be messaged, so they carry on as
-- approved: leaving them `pending` would hide them from the Market and from anyone not yet in a
-- chat, and make `start_conversation` refuse them, for the app people are already using. Removed
-- ones stay removed. A fresh database has no rows here and nothing changes.
update public.listings
   set moderation_status = case when status = 'removed' then 'removed'::public.moderation_status
                                else 'approved'::public.moderation_status end,
       moderation_ref = 'before-moderation',
       moderated_at = now();

alter table public.listings alter column moderation_status set default 'pending';

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_scan_idx on public.listings (scan_id) where scan_id is not null;

-- Tidies the title and description, builds the URL-friendly slug (always, for a signed-in seller),
-- checks that any linked scan belongs to the seller, owns the AI estimate (for a signed-in seller
-- the scan's amount and range, null with no scan, unchanged afterwards), and sends a listing whose
-- words changed back to moderation.
create function public.prepare_listing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  short_id text;
  scan record;
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  new.title := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));
  -- Coordinates are kept coarse (see the column comment above), whatever the client sent.
  new.lat := round(new.lat::numeric, 2)::double precision;
  new.lng := round(new.lng::numeric, 2)::double precision;

  -- New words go back to be screened, unless an admin is holding the listing: an admin's hold
  -- (see admin_review) is lifted by an admin, not by the seller changing a word. `moderated_at`
  -- is when the listing went back in line, so a long-lived listing that was just edited isn't
  -- taken for one whose screening got stuck. Only a seller's edit does this: the database owner or
  -- the service role (a seed, a fix made by hand) sets the state it means to.
  if tg_op = 'UPDATE'
     and current_user in ('anon', 'authenticated')
     and (new.title is distinct from old.title or new.description is distinct from old.description)
     and new.moderation_status is not distinct from old.moderation_status
     and not (old.moderation_status = 'held' and old.moderation_ref like 'admin:%') then
    new.moderation_status := 'pending';
    new.moderation_ref := null;
    new.moderated_at := now();
  end if;

  if tg_op = 'INSERT'
     and ((select auth.uid()) is not null or new.slug is null or btrim(new.slug) = '') then
    base_slug := btrim(regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'), '-');
    base_slug := btrim(left(base_slug, 44), '-');
    if char_length(base_slug) < 2 then
      base_slug := 'item';
    end if;
    short_id := substr(replace(new.id::text, '-', ''), 1, 8);
    new.slug := base_slug || '-' || short_id;
  end if;

  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      if new.scan_id is not null then
        select s.amount_php, s.low_php, s.high_php
          into scan
          from public.scan_history s
         where s.id = new.scan_id
           and s.user_id = new.seller_id;
        if not found then
          raise exception 'A listing can only point at one of your own saved scans.'
            using errcode = '23514';
        end if;
        new.estimate_php := scan.amount_php;
        new.estimate_low_php := scan.low_php;
        new.estimate_high_php := scan.high_php;
        if new.photo_path is null then
          new.photo_path := new.seller_id::text || '/' || new.scan_id::text || '.jpg';
        end if;
      else
        new.estimate_php := null;
        new.estimate_low_php := null;
        new.estimate_high_php := null;
      end if;
    else
      new.estimate_php := old.estimate_php;
      new.estimate_low_php := old.estimate_low_php;
      new.estimate_high_php := old.estimate_high_php;
    end if;
  end if;

  return new;
end;
$$;

create trigger listings_prepare
  before insert or update on public.listings
  for each row execute function public.prepare_listing();

-- A listing's identity, its AI numbers, its verdict, its moderation and its counters are never
-- the seller's to change after it exists. The column grants already leave them out of every
-- update; this is the second lock, so widening a grant later, or an update that reaches a column
-- some other way, still can't rewrite them. It only judges a caller signed in as a client role:
-- the votes, saves and moderation triggers (security definer) and the service role change these
-- columns legitimately. Named so it fires before `listings_prepare`, which itself resets
-- moderation when the words change.
create function public.guard_listing_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A listing an admin removed stays removed: the seller can delete it but not edit it back to
  -- life (changing its words or its status would otherwise send it to be screened again).
  if current_user in ('anon', 'authenticated') and old.moderation_status = 'removed' then
    raise exception 'This listing was removed and can''t be changed.' using errcode = 'SWIMM';
  end if;
  if current_user in ('anon', 'authenticated') and (
    new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.seller_id is distinct from old.seller_id
    or new.scan_id is distinct from old.scan_id
    or new.photo_path is distinct from old.photo_path
    or new.created_at is distinct from old.created_at
    or new.estimate_php is distinct from old.estimate_php
    or new.estimate_low_php is distinct from old.estimate_low_php
    or new.estimate_high_php is distinct from old.estimate_high_php
    or new.verdict is distinct from old.verdict
    or new.verdict_share is distinct from old.verdict_share
    or new.moderation_status is distinct from old.moderation_status
    or new.moderation_ref is distinct from old.moderation_ref
    or new.moderated_at is distinct from old.moderated_at
    or new.views_count is distinct from old.views_count
    or new.saves_count is distinct from old.saves_count
  ) then
    raise exception 'That part of a listing can''t be changed.' using errcode = 'SWIMM';
  end if;
  return new;
end;
$$;

create trigger listings_guard_fields
  before update on public.listings
  for each row execute function public.guard_listing_fields();

-- Flood limits: at most 20 listings created an hour and 100 active listings per seller.
create function public.enforce_listings_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.listings l
     where l.seller_id = new.seller_id
       and l.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'You are listing items too quickly. Try again in a while.'
      using errcode = 'P0001';
  end if;
  if (
    select count(*)
      from public.listings l
     where l.seller_id = new.seller_id
       and l.status = 'active'
  ) >= 100 then
    raise exception 'You have 100 active listings. Mark sold or remove one first.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger listings_enforce_rate_limit
  before insert on public.listings
  for each row execute function public.enforce_listings_rate_limit();

-- Replaces chat's "public until removed" rule: now a listing is public only once approved. Its
-- seller always sees it, whatever its state. A buyer already chatting about it keeps seeing it
-- while it is only waiting to be screened again after an edit, so their chat doesn't vanish
-- (signed-out visitors have no access to conversations, hence the separate policies).
drop policy "Listings are public until removed; sellers see their own" on public.listings;

create policy "Approved listings are public"
  on public.listings for select
  to anon, authenticated
  using (status <> 'removed' and moderation_status = 'approved');

create policy "Sellers see their own listings, whatever their state"
  on public.listings for select
  to authenticated
  using (seller_id = (select auth.uid()));

create policy "Buyers in a chat keep seeing a listing while it is re-screened"
  on public.listings for select
  to authenticated
  using (
    status <> 'removed'
    and moderation_status = 'pending'
    and exists (
      select 1
        from public.conversations c
       where c.listing_id = listings.id
         and c.buyer_id = (select auth.uid())
    )
  );

create policy "Sellers publish their own active listings, pending moderation"
  on public.listings for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'active'
    and moderation_status = 'pending'
    and moderation_ref is null
    and moderated_at is null
  );

create policy "Sellers update their own listings"
  on public.listings for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "Sellers delete their own listings"
  on public.listings for delete
  to authenticated
  using (seller_id = (select auth.uid()));

grant insert (
  id,
  scan_id,
  title,
  asking_php,
  photo_path,
  category,
  condition,
  area,
  lat,
  lng,
  description
) on public.listings to authenticated;

grant update (
  title,
  asking_php,
  category,
  condition,
  area,
  lat,
  lng,
  description,
  status
) on public.listings to authenticated;

grant delete on public.listings to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Scan photos of public listings: readable by everyone while the listing is approved and not removed
-- ---------------------------------------------------------------------------------------------

create policy "People see scan photos of public listings"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.listings l
       where (
         l.photo_path = storage.objects.name
         or (l.scan_id is not null and storage.objects.name = l.seller_id::text || '/' || l.scan_id::text || '.jpg')
       )
         and l.moderation_status = 'approved'
         and l.status <> 'removed'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Opening a chat: any approved, active listing, by its slug or its id
-- ---------------------------------------------------------------------------------------------

-- Replaces chat's version, which knew nothing of moderation: a listing that isn't approved can't
-- be messaged (it can't be seen either), and the key may be the slug or the listing's id, so a
-- link made from either opens a chat. A conversation that already exists is returned as before.
create or replace function public.start_conversation(listing_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target record;
  conversation uuid;
begin
  if caller is null then
    raise exception 'Sign in to message a seller.' using errcode = '42501';
  end if;

  select l.id, l.seller_id, l.status, l.moderation_status
    into target
    from public.listings l
   where l.slug = listing_slug
      -- A CASE, so the cast only runs on text that is a uuid (AND doesn't promise that order).
      or l.id = case
        when listing_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then listing_slug::uuid
      end;
  if not found or target.status = 'removed' then
    raise exception 'This listing is not available.' using errcode = 'P0002';
  end if;
  if target.seller_id = caller then
    raise exception 'This is your own listing.' using errcode = '22023';
  end if;

  select c.id into conversation
    from public.conversations c
   where c.listing_id = target.id
     and c.buyer_id = caller;
  if found then
    return conversation;
  end if;

  if target.moderation_status <> 'approved' then
    raise exception 'This listing is not available.' using errcode = 'P0002';
  end if;
  if target.status <> 'active' then
    raise exception 'This listing has sold.' using errcode = 'SWCLO';
  end if;
  if public.blocked_between(caller, target.seller_id) then
    raise exception 'You can''t message this person.' using errcode = 'SWBLK';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (target.id, caller, target.seller_id)
  returning id into conversation;

  insert into public.conversation_members (conversation_id, user_id)
  values (conversation, caller), (conversation, target.seller_id);

  return conversation;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Saved listings & price-drop alerts (`public.saved_listings`)
-- ---------------------------------------------------------------------------------------------

create table public.saved_listings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  alert_below_php integer not null check (alert_below_php between 1 and 100000000),
  alert_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

comment on table public.saved_listings is 'Listings a buyer has saved, with their price-drop alert target.';

create index saved_listings_listing_idx on public.saved_listings (listing_id);
create index saved_listings_user_created_idx on public.saved_listings (user_id, created_at desc);

create function public.enforce_saved_listings_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.saved_listings s
     where s.user_id = new.user_id
       and s.created_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'You are saving listings too quickly. Try again in a while.'
      using errcode = 'P0001';
  end if;
  if (
    select count(*)
      from public.saved_listings s
     where s.user_id = new.user_id
  ) >= 200 then
    raise exception 'You have 200 saved listings. Remove one you no longer need first.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger saved_listings_enforce_rate_limit
  before insert on public.saved_listings
  for each row execute function public.enforce_saved_listings_rate_limit();

-- Keeps each listing's `saves_count` accurate as buyers save or unsave it.
create function public.sync_listing_saves_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;
begin
  update public.listings l
     set saves_count = (
       select count(*)::integer
         from public.saved_listings s
        where s.listing_id = target_id
     )
   where l.id = target_id;
  return null;
end;
$$;

create trigger saved_listings_sync_count
  after insert or delete on public.saved_listings
  for each row execute function public.sync_listing_saves_count();

alter table public.saved_listings enable row level security;

create policy "People see their own saved listings"
  on public.saved_listings for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "People save public listings for themselves"
  on public.saved_listings for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.listings l
       where l.id = listing_id
         and l.status <> 'removed'
    )
  );

create policy "People update their own saved listing alerts"
  on public.saved_listings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "People remove their own saved listings"
  on public.saved_listings for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.saved_listings from anon, authenticated;
grant select, delete on public.saved_listings to authenticated;
grant insert (listing_id, alert_below_php, alert_enabled) on public.saved_listings to authenticated;
grant update (alert_below_php, alert_enabled) on public.saved_listings to authenticated;

