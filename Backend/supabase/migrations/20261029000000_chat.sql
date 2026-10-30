-- Chats: one conversation between a buyer and a seller about one listing. Messages are plain
-- text, a price offer, or a proposed pickup. Only the two people in a conversation can see it;
-- row-level security enforces that whatever a client sends. Offer and pickup answers, blocks and
-- reads go through the functions at the bottom, so a client can never set a status directly.
--
-- Private messages are not put through moderation (nobody but the two people sees them). Either
-- side can report the conversation or block the other person instead.

-- ---------------------------------------------------------------------------------------------
-- Listings: the minimum a conversation needs. `slug` is the stable public key used in links.
-- Clients cannot write listings yet; the marketplace work will add that.
-- ---------------------------------------------------------------------------------------------

create type public.listing_status as enum ('active', 'sold', 'removed');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  asking_php integer not null check (asking_php > 0),
  photo_url text,
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now()
);

create index listings_seller_idx on public.listings (seller_id);

-- ---------------------------------------------------------------------------------------------
-- Conversations and who is in them.
-- ---------------------------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- A buyer has one conversation per listing; messaging the seller again reopens it.
  unique (listing_id, buyer_id),
  constraint conversations_two_people check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

-- One row per person in a conversation: how far they have read.
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

-- Whether the caller is in a conversation. Security definer so policies can call it without
-- recursing through the members table's own policy.
create function public.is_conversation_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.conversation_members m
     where m.conversation_id = target
       and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Blocks. A block stops new messages both ways, in every conversation between the two people.
-- ---------------------------------------------------------------------------------------------

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.user_blocks k
     where (k.blocker_id = a and k.blocked_id = b)
        or (k.blocker_id = b and k.blocked_id = a)
  );
$$;

revoke all on function public.blocked_between(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Messages.
-- ---------------------------------------------------------------------------------------------

create type public.message_kind as enum ('text', 'offer', 'meetup');
-- `countered` means a newer offer, from either side, replaced this one.
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'countered');
create type public.meetup_status as enum ('proposed', 'confirmed');

create table public.messages (
  -- `id` is client-assignable so a retried send is idempotent (a resend conflicts, not doubles).
  id uuid primary key default gen_random_uuid(),
  -- Insertion order, so messages sent in the same instant still read in the order they arrived.
  seq bigint generated always as identity,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.message_kind not null default 'text',
  -- The text of a message, or an optional note on an offer.
  body text not null default '' check (char_length(body) <= 1000),
  offer_php integer check (offer_php between 1 and 100000000),
  offer_status public.offer_status,
  meetup_place text check (char_length(btrim(meetup_place)) between 1 and 120),
  meetup_when text check (char_length(btrim(meetup_when)) between 1 and 80),
  meetup_status public.meetup_status,
  created_at timestamptz not null default now(),
  constraint messages_shape check (
    case kind
      when 'text' then
        char_length(body) >= 1
        and offer_php is null and offer_status is null
        and meetup_place is null and meetup_when is null and meetup_status is null
      when 'offer' then
        offer_php is not null and offer_status is not null
        and meetup_place is null and meetup_when is null and meetup_status is null
      when 'meetup' then
        meetup_place is not null and meetup_when is not null and meetup_status is not null
        and offer_php is null and offer_status is null
    end
  )
);

create index messages_conversation_seq_idx on public.messages (conversation_id, seq);
create index messages_sender_created_idx on public.messages (sender_id, created_at desc);

-- Gets a new message ready and refuses one that cannot be sent: trims it, starts offers and
-- pickups in their first status, and checks the conversation is still open. A new offer
-- replaces any offer still open in the conversation, from either side.
create function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  convo record;
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
    new.meetup_place := btrim(new.meetup_place);
    new.meetup_when := btrim(new.meetup_when);
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

create trigger messages_prepare
  before insert on public.messages
  for each row execute function public.prepare_message();

-- Sending counts as reading: the sender's own messages never show as unread to them.
create function public.after_message_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  update public.conversation_members
     set last_read_at = greatest(last_read_at, new.created_at)
   where conversation_id = new.conversation_id
     and user_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_after_sent
  after insert on public.messages
  for each row execute function public.after_message_sent();

-- ---------------------------------------------------------------------------------------------
-- Reports: either person can report a conversation, once.
-- ---------------------------------------------------------------------------------------------

create table public.conversation_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('scam', 'harassment', 'spam', 'other')),
  created_at timestamptz not null default now(),
  unique (conversation_id, reporter_id)
);

-- ---------------------------------------------------------------------------------------------
-- Row-level security.
-- ---------------------------------------------------------------------------------------------

alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.user_blocks enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reports enable row level security;

create policy "Listings are public until removed; sellers see their own"
  on public.listings for select
  to anon, authenticated
  using (status <> 'removed' or seller_id = (select auth.uid()));

create policy "Members see their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id));

create policy "Members see who is in their conversations"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "Users see who they have blocked"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Members read their conversations' messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "Members send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "Members report their conversations"
  on public.conversation_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "Users see their own reports"
  on public.conversation_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- Column-level grants back the policies up: statuses, senders and timestamps are never
-- writable from a client, and nothing but a message or a report is ever inserted directly.
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;

revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

revoke all on public.conversation_members from anon, authenticated;
grant select on public.conversation_members to authenticated;

revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (id, conversation_id, kind, body, offer_php, meetup_place, meetup_when)
  on public.messages to authenticated;

revoke all on public.conversation_reports from anon, authenticated;
grant select on public.conversation_reports to authenticated;
grant insert (conversation_id, reason) on public.conversation_reports to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Functions clients call.
-- ---------------------------------------------------------------------------------------------

-- Opens the caller's conversation with a listing's seller, or returns the one they already
-- have. A new conversation needs an active listing that isn't the caller's own.
create function public.start_conversation(listing_slug text)
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

  select l.id, l.seller_id, l.status
    into target
    from public.listings l
   where l.slug = listing_slug;
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

revoke all on function public.start_conversation(text) from public, anon;
grant execute on function public.start_conversation(text) to authenticated;

-- Checks that the caller may answer `target`: someone else's message, in an open conversation
-- the caller is in, with nobody blocked. Returns the message's conversation.
create function public.answerable_message(target uuid, wanted public.message_kind)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_message record;
begin
  select m.conversation_id, m.sender_id, m.kind, c.buyer_id, c.seller_id, l.status
    into found_message
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    join public.listings l on l.id = c.listing_id
   where m.id = target;

  if not found
     or found_message.kind <> wanted
     or not public.is_conversation_member(found_message.conversation_id) then
    raise exception 'That message is not available.' using errcode = 'P0002';
  end if;
  if found_message.sender_id = (select auth.uid()) then
    raise exception 'You can''t answer your own message.' using errcode = '22023';
  end if;
  if found_message.status <> 'active' then
    raise exception 'This conversation is closed.' using errcode = 'SWCLO';
  end if;
  if public.blocked_between(found_message.buyer_id, found_message.seller_id) then
    raise exception 'You can''t message this person.' using errcode = 'SWBLK';
  end if;
  return found_message.conversation_id;
end;
$$;

revoke all on function public.answerable_message(uuid, public.message_kind)
  from public, anon, authenticated;

-- Accepts or declines an open offer from the other person. Answering an offer that is no longer
-- open (it was countered, or already answered) is refused.
create function public.respond_to_offer(target uuid, accept boolean)
returns public.offer_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.offer_status :=
    case when accept then 'accepted'::public.offer_status else 'declined'::public.offer_status end;
begin
  perform public.answerable_message(target, 'offer');
  update public.messages
     set offer_status = next_status
   where id = target
     and offer_status = 'pending';
  if not found then
    raise exception 'This offer is no longer open.' using errcode = 'SWOLD';
  end if;
  return next_status;
end;
$$;

revoke all on function public.respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;

-- Agrees to a pickup the other person proposed. Confirming twice is harmless.
create function public.confirm_meetup(target uuid)
returns public.meetup_status
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.answerable_message(target, 'meetup');
  update public.messages set meetup_status = 'confirmed' where id = target;
  return 'confirmed'::public.meetup_status;
end;
$$;

revoke all on function public.confirm_meetup(uuid) from public, anon;
grant execute on function public.confirm_meetup(uuid) to authenticated;

-- Marks everything in a conversation as read by the caller.
create function public.mark_conversation_read(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members
     set last_read_at = now()
   where conversation_id = target
     and user_id = (select auth.uid());
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Blocks or unblocks another person. Both are idempotent.
create function public.set_block(target uuid, blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if target = caller then
    raise exception 'You can''t block yourself.' using errcode = '22023';
  end if;
  if blocked then
    insert into public.user_blocks (blocker_id, blocked_id)
    values (caller, target)
    on conflict do nothing;
  else
    delete from public.user_blocks where blocker_id = caller and blocked_id = target;
  end if;
end;
$$;

revoke all on function public.set_block(uuid, boolean) from public, anon;
grant execute on function public.set_block(uuid, boolean) to authenticated;

-- The caller's conversations (or just `target`), newest activity first, each with the other person, the listing,
-- the latest message, and how many messages from the other person the caller hasn't read.
-- `closed` is 'sold' once the listing sells and 'archived' once it is removed.
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
    select m.kind, m.body, m.offer_php, m.meetup_place, m.sender_id
      from public.messages m
     where m.conversation_id = c.id
     order by m.seq desc
     limit 1
  ) last on true
  where target is null or c.id = target
  order by c.last_message_at desc;
$$;

grant execute on function public.conversation_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: new messages and offer/pickup answers stream to the two people in a conversation.
-- Supabase applies the select policy above to every change it sends.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
