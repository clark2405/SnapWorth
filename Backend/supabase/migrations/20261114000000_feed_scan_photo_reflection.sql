-- Ensure photos taken from phones reflect in feed posts and listings by:
-- 1. Auto-populating photo_path and scan_id in prepare_feed_post()
-- 2. Auto-populating photo_path in prepare_listing()
-- 3. Updating storage policies for scan-photos to recognize scan_id paths
-- 4. Backfilling existing rows where photo_path was omitted

create or replace function public.prepare_feed_post()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  short_id text;
  scan_amount integer;
  listing_estimate integer;
  listing_scan_id uuid;
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  new.body := btrim(new.body);
  new.title := btrim(coalesce(new.title, ''));

  if tg_op = 'INSERT' and (new.slug is null or btrim(new.slug) = '') then
    base_slug := btrim(
      regexp_replace(lower(coalesce(nullif(new.title, ''), new.body)), '[^a-z0-9]+', '-', 'g'),
      '-'
    );
    base_slug := btrim(left(base_slug, 44), '-');
    if char_length(base_slug) < 2 then
      base_slug := 'post';
    end if;
    short_id := right(replace(new.id::text, '-', ''), 8);
    new.slug := base_slug || '-' || short_id;
  end if;

  if (select auth.uid()) is not null then
    if new.listing_id is not null then
      select l.estimate_php, l.scan_id
        into listing_estimate, listing_scan_id
        from public.listings l
       where l.id = new.listing_id
         and l.seller_id = new.owner_id;
      if not found then
        raise exception 'A feed post can only repost one of your own listings.'
          using errcode = '23514';
      end if;
      if new.scan_id is null and listing_scan_id is not null then
        new.scan_id := listing_scan_id;
      end if;
    end if;

    if new.scan_id is not null then
      select s.amount_php
        into scan_amount
        from public.scan_history s
       where s.id = new.scan_id
         and s.user_id = new.owner_id;
      if not found then
        raise exception 'A feed post can only point at one of your own saved scans.'
          using errcode = '23514';
      end if;
      if new.photo_path is null then
        new.photo_path := new.owner_id::text || '/' || new.scan_id::text || '.jpg';
      end if;
    end if;

    if tg_op = 'INSERT' then
      -- A repost shows the listing's estimate; a post about a scan shows the scan's.
      new.estimate_php := case
        when new.listing_id is not null then listing_estimate
        else scan_amount
      end;
    else
      new.estimate_php := old.estimate_php;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_listing()
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
  new.lat := round(new.lat::numeric, 2)::double precision;
  new.lng := round(new.lng::numeric, 2)::double precision;

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

drop policy if exists "People see scan photos of approved feed posts" on storage.objects;
create policy "People see scan photos of approved feed posts"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.feed_posts p
       where (
         p.photo_path = storage.objects.name
         or (p.scan_id is not null and storage.objects.name = p.owner_id::text || '/' || p.scan_id::text || '.jpg')
       )
         and p.moderation_status = 'approved'
    )
  );

drop policy if exists "People see scan photos of public listings" on storage.objects;
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

update public.feed_posts
   set photo_path = owner_id::text || '/' || scan_id::text || '.jpg'
 where scan_id is not null and photo_path is null;

update public.listings
   set photo_path = seller_id::text || '/' || scan_id::text || '.jpg'
 where scan_id is not null and photo_path is null;

