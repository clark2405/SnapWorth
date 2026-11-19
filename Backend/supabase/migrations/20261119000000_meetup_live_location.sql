-- Live location for an agreed meetup: once both people have confirmed a pickup or viewing, either
-- of them can share where they are, so they can find each other at the spot.
--
-- What's kept is one row per person per meetup: their latest position, overwritten as they move,
-- and deleted when they stop. Only the other person in the conversation can read it, only while
-- it's fresh (a position older than 15 minutes is never shown, whatever the app does), and never
-- across a block. Nobody writes the table directly: the two functions below are the only way in,
-- and they check that the meetup was agreed, the other person still has an account, and neither
-- has blocked the other.

create table public.meetup_locations (
  meetup_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- How far off the phone said the fix might be, in metres.
  accuracy_m real check (accuracy_m is null or accuracy_m between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

create index meetup_locations_conversation_idx on public.meetup_locations (conversation_id);

alter table public.meetup_locations enable row level security;

-- Whether the caller may see `owner`'s shared location in `conversation`: they're in it, and
-- neither has blocked the other. Security definer so the policy can ask about blocks, which the
-- caller can't read for the other side.
create function public.meetup_location_visible(conversation uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_conversation_member(conversation)
         and not public.blocked_between((select auth.uid()), owner);
$$;

revoke all on function public.meetup_location_visible(uuid, uuid) from public, anon;
grant execute on function public.meetup_location_visible(uuid, uuid) to authenticated;

create policy "The two people see each other's fresh location"
  on public.meetup_locations
  for select
  to authenticated
  using (
    updated_at > now() - interval '15 minutes'
    and public.meetup_location_visible(conversation_id, user_id)
  );

revoke all on public.meetup_locations from public, anon, authenticated;
grant select on public.meetup_locations to authenticated;

-- Shares (or moves) the caller's position for an agreed meetup. Refused, with the chat's own
-- codes, when the meetup isn't one of theirs or wasn't agreed, the other person's account is
-- gone, either has blocked the other, or the meetup was proposed more than 30 days ago.
create function public.share_meetup_location(
  meetup uuid,
  lat double precision,
  lng double precision,
  accuracy_m real default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  found_meetup record;
begin
  if me is null then
    raise exception 'Sign in to share your location.' using errcode = '42501';
  end if;

  select m.conversation_id, m.kind, m.meetup_status, m.created_at, c.buyer_id, c.seller_id
    into found_meetup
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.id = meetup;

  if not found
     or found_meetup.kind <> 'meetup'
     or not public.is_conversation_member(found_meetup.conversation_id) then
    raise exception 'That meetup is not available.' using errcode = 'P0002';
  end if;
  if found_meetup.meetup_status is distinct from 'confirmed' then
    raise exception 'Share your location once you have both agreed to the meetup.'
      using errcode = '22023';
  end if;
  if found_meetup.created_at < now() - interval '30 days' then
    raise exception 'This meetup is too old to share a location for.' using errcode = '22023';
  end if;
  -- The other person's account is gone (their side is null): there's nobody to share with.
  if found_meetup.buyer_id is null or found_meetup.seller_id is null then
    raise exception 'This conversation is closed.' using errcode = 'SWCLO';
  end if;
  if public.blocked_between(found_meetup.buyer_id, found_meetup.seller_id) then
    raise exception 'You can''t share with this person.' using errcode = 'SWBLK';
  end if;

  insert into public.meetup_locations (meetup_id, user_id, conversation_id, lat, lng, accuracy_m)
  values (meetup, me, found_meetup.conversation_id, lat, lng, accuracy_m)
  on conflict (meetup_id, user_id) do update
     set lat = excluded.lat,
         lng = excluded.lng,
         accuracy_m = excluded.accuracy_m,
         updated_at = now();
end;
$$;

revoke all on function public.share_meetup_location(uuid, double precision, double precision, real)
  from public, anon;
grant execute on function public.share_meetup_location(uuid, double precision, double precision, real)
  to authenticated;

-- Stops sharing: the caller's position for the meetup is deleted. Stopping twice is harmless.
create function public.stop_sharing_meetup_location(meetup uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.meetup_locations
   where meetup_id = meetup
     and user_id = (select auth.uid());
$$;

revoke all on function public.stop_sharing_meetup_location(uuid) from public, anon;
grant execute on function public.stop_sharing_meetup_location(uuid) to authenticated;

-- Realtime: a position moving streams to the other person. Supabase applies the select policy
-- above to every change it sends.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.meetup_locations;
  end if;
end;
$$;
