-- Market: real listings, seller profile details, saved listings with price-drop alerts, and
-- public read access to a scan's photo while a public listing points at it.
--
-- * Never copy `scan_history.paid_php` onto a listing: what the seller paid is private to them.
-- * A listing's `asking_php` is always entered by the seller; `estimate_php`, `estimate_low_php`
--   and `estimate_high_php` are the AI valuation range shown alongside it for buyers.
-- * `slug` stays the stable public key so `start_conversation(listing_slug)` and `/listing/[id]`
--   links work for both seeded slugs and newly published listings.

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
  add column lat double precision check (lat is null or lat between 4.5 and 21.5),
  add column lng double precision check (lng is null or lng between 116.0 and 127.0),
  add column distance_km numeric(6,1) not null default 5
    check (distance_km >= 0 and distance_km <= 2000),
  add column description text not null default ''
    check (char_length(description) <= 1000),
  add column estimate_php integer check (estimate_php is null or estimate_php >= 0),
  add column estimate_low_php integer check (estimate_low_php is null or estimate_low_php >= 0),
  add column estimate_high_php integer
    check (estimate_high_php is null or (estimate_low_php is not null and estimate_high_php >= estimate_low_php)),
  add column verdict text not null default 'just_right'
    check (verdict in ('too_high', 'just_right', 'too_low')),
  add column verdict_share integer not null default 75
    check (verdict_share between 0 and 100),
  add column views_count integer not null default 0 check (views_count >= 0),
  add column saves_count integer not null default 0 check (saves_count >= 0),
  add constraint listings_photo_path_check
    check (
      photo_path is null
      or (scan_id is not null and photo_path = seller_id::text || '/' || scan_id::text || '.jpg')
    );

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_scan_idx on public.listings (scan_id) where scan_id is not null;

-- Tidies the title and description, builds a URL-friendly slug when the client didn't supply one,
-- and checks that any linked scan belongs to the seller.
create function public.prepare_listing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  short_id text;
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  new.title := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));

  if tg_op = 'INSERT' and (new.slug is null or btrim(new.slug) = '') then
    base_slug := btrim(regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'), '-');
    base_slug := btrim(left(base_slug, 44), '-');
    if char_length(base_slug) < 2 then
      base_slug := 'item';
    end if;
    short_id := substr(replace(new.id::text, '-', ''), 1, 8);
    new.slug := base_slug || '-' || short_id;
  end if;

  if new.scan_id is not null and (select auth.uid()) is not null then
    if not exists (
      select 1
        from public.scan_history s
       where s.id = new.scan_id
         and s.user_id = new.seller_id
    ) then
      raise exception 'A listing can only point at one of your own saved scans.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger listings_prepare
  before insert or update on public.listings
  for each row execute function public.prepare_listing();

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

create policy "Sellers publish their own active listings"
  on public.listings for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'active'
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
  slug,
  scan_id,
  title,
  asking_php,
  photo_path,
  category,
  condition,
  area,
  lat,
  lng,
  distance_km,
  description,
  estimate_php,
  estimate_low_php,
  estimate_high_php
) on public.listings to authenticated;

grant update (
  title,
  asking_php,
  category,
  condition,
  area,
  lat,
  lng,
  distance_km,
  description,
  status
) on public.listings to authenticated;

grant delete on public.listings to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Scan photos of public listings: readable by everyone while the listing is not removed
-- ---------------------------------------------------------------------------------------------

create policy "People see scan photos of public listings"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.listings l
       where l.photo_path = storage.objects.name
         and l.status <> 'removed'
    )
  );

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
