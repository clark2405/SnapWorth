-- Meetups on a map: each pickup, or a viewing for someone who wants to see the item in person,
-- carries a pin the two people agree on. The pin can go anywhere in the Philippines. A list of
-- busy public places is kept here as suggestions: a meetup that names one of them by key gets the
-- place's name and coordinates from this table, so a suggested place always shows where it
-- really is, whatever the sender's app sent.

create table public.meetup_spots (
  key text primary key check (key ~ '^[a-z0-9-]{2,48}$'),
  name text not null check (char_length(name) between 1 and 120),
  city text not null,
  -- The part of the city the place is in.
  area text not null check (
    area in ('downtown', 'uptown', 'business-park', 'it-park', 'reclamation', 'srp')
  ),
  lat double precision not null check (lat between 4.5 and 21.5),
  lng double precision not null check (lng between 116 and 127),
  active boolean not null default true
);

comment on table public.meetup_spots is
  'Public places buyers and sellers can meet. Keep in step with meetup-spots.ts in the app.';

-- Busy public places in Cebu City, where SnapWorth starts. Coordinates are from each place's
-- Wikipedia entry (Fuente Osmeña Circle, which has none, from Waze), cross-checked with
-- latlong.net, Sygic, Travelprofy and findlatitudeandlongitude.com where they list it
-- (October 2026).
insert into public.meetup_spots (key, name, city, area, lat, lng) values
  ('sm-city-cebu', 'SM City Cebu', 'Cebu City', 'reclamation', 10.311111, 123.918056),
  ('robinsons-galleria-cebu', 'Robinsons Galleria Cebu', 'Cebu City', 'reclamation', 10.304167, 123.911111),
  ('ayala-center-cebu', 'Ayala Center Cebu', 'Cebu City', 'business-park', 10.317778, 123.905),
  ('ayala-central-bloc', 'Ayala Malls Central Bloc, IT Park', 'Cebu City', 'it-park', 10.330556, 123.907222),
  ('fuente-osmena', 'Fuente Osmeña Circle', 'Cebu City', 'uptown', 10.309848, 123.893135),
  ('plaza-independencia', 'Plaza Independencia', 'Cebu City', 'downtown', 10.292917, 123.905556),
  ('sm-seaside-cebu', 'SM Seaside City Cebu', 'Cebu City', 'srp', 10.280389, 123.881833);

alter table public.meetup_spots enable row level security;
create policy "Active meetup spots are public"
  on public.meetup_spots for select
  to anon, authenticated
  using (active);
revoke all on public.meetup_spots from anon, authenticated;
grant select on public.meetup_spots to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Meetup messages: why they're meeting, and where on the map.
-- ---------------------------------------------------------------------------------------------

alter table public.messages
  add column meetup_purpose text check (meetup_purpose in ('pickup', 'viewing')),
  add column meetup_spot text references public.meetup_spots (key),
  -- A pin anywhere in the Philippines; the app holds pins to the same box.
  add column meetup_lat double precision check (meetup_lat between 4.5 and 21.5),
  add column meetup_lng double precision check (meetup_lng between 116 and 127);

update public.messages set meetup_purpose = 'pickup' where kind = 'meetup';

alter table public.messages drop constraint messages_shape;
alter table public.messages add constraint messages_shape check (
  case kind
    when 'text' then
      char_length(body) >= 1
      and offer_php is null and offer_status is null
      and meetup_place is null and meetup_when is null and meetup_status is null
      and meetup_purpose is null and meetup_spot is null
      and meetup_lat is null and meetup_lng is null
    when 'offer' then
      offer_php is not null and offer_status is not null
      and meetup_place is null and meetup_when is null and meetup_status is null
      and meetup_purpose is null and meetup_spot is null
      and meetup_lat is null and meetup_lng is null
    when 'meetup' then
      meetup_place is not null and meetup_when is not null and meetup_status is not null
      and meetup_purpose is not null
      and (meetup_lat is null) = (meetup_lng is null)
      and (meetup_spot is null or meetup_lat is not null)
      and offer_php is null and offer_status is null
  end
);

grant insert (meetup_purpose, meetup_spot, meetup_lat, meetup_lng)
  on public.messages to authenticated;

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  convo record;
  spot record;
begin
  select c.buyer_id, c.seller_id, l.status as listing_status
    into convo
    from public.conversations c
    join public.listings l on l.id = c.listing_id
   where c.id = new.conversation_id;

  if not found then
    raise exception 'This conversation is not available.' using errcode = 'P0002';
  end if;
  if convo.listing_status <> 'active' then
    raise exception 'This conversation is closed.' using errcode = 'SWCLO';
  end if;
  if public.blocked_between(convo.buyer_id, convo.seller_id) then
    raise exception 'You can''t message this person.' using errcode = 'SWBLK';
  end if;
  if (
    select count(*)
      from public.messages m
     where m.sender_id = new.sender_id
       and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'You are sending messages too quickly. Try again in a minute.'
      using errcode = 'P0001';
  end if;

  new.body := btrim(new.body);
  new.created_at := now();
  new.offer_status := case when new.kind = 'offer' then 'pending'::public.offer_status end;
  new.meetup_status := case when new.kind = 'meetup' then 'proposed'::public.meetup_status end;
  if new.kind = 'meetup' then
    new.meetup_purpose := coalesce(new.meetup_purpose, 'pickup');
    -- A suggested place's name and pin come from the list, whatever the sender's app sent.
    if new.meetup_spot is not null then
      select s.name, s.lat, s.lng
        into spot
        from public.meetup_spots s
       where s.key = new.meetup_spot
         and s.active;
      if not found then
        raise exception 'That meetup spot is not available.' using errcode = '22023';
      end if;
      new.meetup_place := spot.name;
      new.meetup_lat := spot.lat;
      new.meetup_lng := spot.lng;
    end if;
    new.meetup_place := btrim(new.meetup_place);
    new.meetup_when := btrim(new.meetup_when);
  else
    new.meetup_purpose := null;
    new.meetup_spot := null;
    new.meetup_lat := null;
    new.meetup_lng := null;
  end if;

  if new.kind = 'offer' then
    update public.messages
       set offer_status = 'countered'
     where conversation_id = new.conversation_id
       and kind = 'offer'
       and offer_status = 'pending';
  end if;
  return new;
end;
$$;

-- The list's latest-message preview now says whether a meetup is a pickup or a viewing.
drop function public.conversation_list(uuid);

create function public.conversation_list(target uuid default null)
returns table (
  id uuid,
  listing_slug text,
  listing_title text,
  listing_photo_url text,
  asking_php integer,
  closed text,
  other_id uuid,
  other_handle text,
  other_avatar_url text,
  i_am_seller boolean,
  last_kind public.message_kind,
  last_body text,
  last_offer_php integer,
  last_meetup_place text,
  last_meetup_purpose text,
  last_from_me boolean,
  last_message_at timestamptz,
  unread_count integer,
  blocked_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    l.slug,
    l.title,
    l.photo_url,
    l.asking_php,
    case l.status when 'sold' then 'sold' when 'removed' then 'archived' end,
    other.id,
    other.handle,
    other.avatar_url,
    c.seller_id = (select auth.uid()),
    last.kind,
    last.body,
    last.offer_php,
    last.meetup_place,
    last.meetup_purpose,
    last.sender_id = (select auth.uid()),
    c.last_message_at,
    (
      select count(*)::integer
        from public.messages u
       where u.conversation_id = c.id
         and u.sender_id <> (select auth.uid())
         and u.created_at > me.last_read_at
    ),
    exists (
      select 1
        from public.user_blocks k
       where k.blocker_id = (select auth.uid())
         and k.blocked_id = other.id
    )
  from public.conversations c
  join public.conversation_members me
    on me.conversation_id = c.id and me.user_id = (select auth.uid())
  join public.listings l on l.id = c.listing_id
  join public.profiles other
    on other.id = case when c.buyer_id = (select auth.uid()) then c.seller_id else c.buyer_id end
  left join lateral (
    select m.kind, m.body, m.offer_php, m.meetup_place, m.meetup_purpose, m.sender_id
      from public.messages m
     where m.conversation_id = c.id
     order by m.seq desc
     limit 1
  ) last on true
  where target is null or c.id = target
  order by c.last_message_at desc;
$$;

grant execute on function public.conversation_list(uuid) to authenticated;
