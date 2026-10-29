-- Meetups on a map: each pickup, or a viewing for someone who wants to see the item in person,
-- can be pinned to one of a list of busy public places. The places, with their coordinates, live
-- here on the server. A message names a spot by its key, and the trigger copies the spot's name
-- and coordinates onto it, so a pin always shows the place it is labelled with: nobody can send
-- "SM Megamall" pointing somewhere quiet. Clients cannot write coordinates at all.

create table public.meetup_spots (
  key text primary key check (key ~ '^[a-z0-9-]{2,48}$'),
  name text not null check (char_length(name) between 1 and 120),
  city text not null,
  -- The part of Metro Manila the map zooms to.
  area text not null check (area in ('makati', 'bgc', 'ortigas', 'quezon-city', 'manila')),
  lat double precision not null check (lat between 14.3 and 14.8),
  lng double precision not null check (lng between 120.9 and 121.2),
  active boolean not null default true
);

comment on table public.meetup_spots is
  'Public places buyers and sellers can meet. Keep in step with meetup-spots.ts in the app.';

insert into public.meetup_spots (key, name, city, area, lat, lng) values
  ('greenbelt', 'Greenbelt 3', 'Makati', 'makati', 14.5522, 121.0213),
  ('ayala-triangle', 'Ayala Triangle Gardens', 'Makati', 'makati', 14.5571, 121.0237),
  ('glorietta', 'Glorietta', 'Makati', 'makati', 14.5509, 121.0254),
  ('high-street', 'Bonifacio High Street', 'Taguig', 'bgc', 14.5506, 121.0511),
  ('market-market', 'Market! Market!', 'Taguig', 'bgc', 14.5497, 121.0563),
  ('sm-aura', 'SM Aura Premier', 'Taguig', 'bgc', 14.5466, 121.0546),
  ('megamall', 'SM Megamall', 'Mandaluyong', 'ortigas', 14.5849, 121.0566),
  ('shangri-la', 'Shangri-La Plaza', 'Mandaluyong', 'ortigas', 14.5813, 121.0538),
  ('estancia', 'Estancia, Capitol Commons', 'Pasig', 'ortigas', 14.5753, 121.0628),
  ('sm-north', 'SM North EDSA', 'Quezon City', 'quezon-city', 14.6565, 121.0293),
  ('trinoma', 'TriNoma', 'Quezon City', 'quezon-city', 14.6535, 121.0336),
  ('up-town-center', 'UP Town Center', 'Quezon City', 'quezon-city', 14.6504, 121.0751),
  ('gateway', 'Gateway Mall, Araneta City', 'Quezon City', 'quezon-city', 14.6221, 121.053),
  ('eastwood', 'Eastwood City', 'Quezon City', 'quezon-city', 14.6091, 121.0798),
  ('mall-of-asia', 'SM Mall of Asia', 'Pasay', 'manila', 14.5352, 120.9822),
  ('rizal-park', 'Rizal Park', 'Manila', 'manila', 14.5831, 120.9794),
  ('robinsons-manila', 'Robinsons Place Manila', 'Manila', 'manila', 14.5766, 120.9839);

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
  add column meetup_lat double precision,
  add column meetup_lng double precision;

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
      and (meetup_spot is null) = (meetup_lat is null)
      and offer_php is null and offer_status is null
  end
);

grant insert (meetup_purpose, meetup_spot) on public.messages to authenticated;

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
  -- Coordinates only ever come from the spots table, so a pin always shows the place it names.
  new.meetup_lat := null;
  new.meetup_lng := null;
  if new.kind = 'meetup' then
    new.meetup_purpose := coalesce(new.meetup_purpose, 'pickup');
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
