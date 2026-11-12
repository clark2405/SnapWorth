-- Deleting an account no longer deletes the other person's side of their chats.
--
-- Until now every reference to a person was ON DELETE CASCADE, so deleting an account also deleted
-- every conversation they were in, with the other person's messages, offers and agreed meetups.
-- Now the other person keeps the conversation and its history; the deleted person is simply gone
-- from it (shown as "Deleted account"), and the chat is closed: nobody can send, answer an offer,
-- or confirm a meetup in it. What each table does when a person goes:
--
--   conversations.buyer_id / seller_id   ON DELETE SET NULL   the conversation survives
--   messages.sender_id                   ON DELETE SET NULL   their messages stay, from "nobody"
--   conversation_members.user_id         cascade              their read position goes with them
--   conversation_reports.reporter_id     cascade              reports they made go (reports about
--                                                             them stay, from the other person)
--   user_blocks, suki_discounts, ...     cascade              their own private rows go
--   conversations.listing_id             ON DELETE SET NULL   a chat about a listing that no longer
--                                                             exists (its seller's account was
--                                                             deleted, or they deleted the listing)
--                                                             survives for the other person, closed
--
-- A conversation nobody is left in is deleted with the last person's account (the
-- `conversation_members` trigger below), so no chat of nobody's is left behind. The deleted
-- person's own listings still go with them.
--
-- Nobody gains access: reading a conversation still needs a `conversation_members` row, which only
-- the two people ever had; a null side never matches anyone. The functions that read these rows
-- are replaced to cope with a null side or listing: `prepare_message` and `answerable_message`
-- (so sending, answering an offer and confirming a meetup are refused as closed),
-- `conversation_list` (the other person comes back null and `closed` is 'deleted'; a chat whose
-- listing is gone is 'archived') and `admin_review_queue` (a report about a deleted listing's chat
-- is still listed).
--
-- Upgrade-safe on a live database: dropping NOT NULL changes no row, the three foreign keys are
-- dropped and added back under their usual names (existing rows already satisfy them), and every
-- function is replaced in place with the same signature.

-- ---------------------------------------------------------------------------------------------
-- Foreign keys: the other person's chat survives
-- ---------------------------------------------------------------------------------------------

alter table public.conversations
  alter column listing_id drop not null,
  alter column buyer_id drop not null,
  alter column seller_id drop not null;

alter table public.messages
  alter column sender_id drop not null;

-- Replaces whatever foreign key is on each column (found in the catalogue, not by name) with one
-- that sets the column to null when the row it points at goes.
do $$
declare
  fix record;
  existing record;
begin
  for fix in
    select * from (values
      ('conversations', 'listing_id', 'listings'),
      ('conversations', 'buyer_id', 'profiles'),
      ('conversations', 'seller_id', 'profiles'),
      ('messages', 'sender_id', 'profiles')
    ) as t (tbl, col, target)
  loop
    for existing in
      select c.conname
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f'
         and c.conrelid = format('public.%I', fix.tbl)::regclass
         and array_length(c.conkey, 1) = 1
         and a.attname = fix.col
    loop
      execute format('alter table public.%I drop constraint %I', fix.tbl, existing.conname);
    end loop;
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete set null',
      fix.tbl, fix.tbl || '_' || fix.col || '_fkey', fix.col, fix.target
    );
  end loop;
end;
$$;

-- When the last person in a conversation goes, so does the conversation.
create function public.drop_abandoned_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversations c
   where c.id = old.conversation_id
     and not exists (
       select 1 from public.conversation_members m where m.conversation_id = c.id
     );
  return null;
end;
$$;

revoke all on function public.drop_abandoned_conversation() from public, anon, authenticated;

create trigger conversation_members_drop_abandoned
  after delete on public.conversation_members
  for each row execute function public.drop_abandoned_conversation();

-- ---------------------------------------------------------------------------------------------
-- Functions: closed when a side or the listing is gone
-- ---------------------------------------------------------------------------------------------

-- Gets a new message ready and refuses one that cannot be sent (as before), and now refuses one
-- in a conversation whose other person, or whose listing, is gone.
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
    left join public.listings l on l.id = c.listing_id
   where c.id = new.conversation_id;

  if not found then
    raise exception 'This conversation is not available.' using errcode = 'P0002';
  end if;
  -- Closed: its listing has sold or gone (a deleted listing leaves no row, so no status), or
  -- the other person's account was deleted (their side is null).
  if convo.buyer_id is null
     or convo.seller_id is null
     or convo.listing_status is distinct from 'active' then
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

-- Checks that the caller may answer `target` (as before), and refuses a closed conversation: its
-- listing sold or gone, or the other person's account deleted.
create or replace function public.answerable_message(target uuid, wanted public.message_kind)
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
    left join public.listings l on l.id = c.listing_id
   where m.id = target;

  if not found
     or found_message.kind <> wanted
     or not public.is_conversation_member(found_message.conversation_id) then
    raise exception 'That message is not available.' using errcode = 'P0002';
  end if;
  if found_message.sender_id = (select auth.uid()) then
    raise exception 'You can''t answer your own message.' using errcode = '22023';
  end if;
  -- Closed: the listing has sold or gone (no row, so no status), or the other person's account
  -- was deleted (their side is null).
  if found_message.buyer_id is null
     or found_message.seller_id is null
     or found_message.status is distinct from 'active' then
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

-- The caller's conversations (as before). A deleted other person comes back as nulls (the app
-- says "Deleted account") and `closed` is 'deleted'; a chat whose listing is gone has no slug,
-- photo or price, the title "Deleted listing", and `closed` 'archived'.
create or replace function public.conversation_list(target uuid default null)
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
    coalesce(l.title, 'Deleted listing'),
    l.photo_url,
    l.asking_php,
    case
      when c.buyer_id is null or c.seller_id is null then 'deleted'
      when c.listing_id is null then 'archived'
      else case l.status when 'sold' then 'sold' when 'removed' then 'archived' end
    end,
    other.id,
    other.handle,
    other.avatar_url,
    coalesce(c.seller_id = (select auth.uid()), false),
    last.kind,
    last.body,
    last.offer_php,
    last.meetup_place,
    last.meetup_purpose,
    coalesce(last.sender_id = (select auth.uid()), false),
    c.last_message_at,
    (
      select count(*)::integer
        from public.messages u
       where u.conversation_id = c.id
         and u.sender_id is distinct from (select auth.uid())
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
  left join public.listings l on l.id = c.listing_id
  left join public.profiles other
    on other.id = case when c.buyer_id = (select auth.uid()) then c.seller_id else c.buyer_id end
  left join lateral (
    select m.kind, m.body, m.offer_php, m.meetup_place, m.meetup_purpose, m.sender_id
      from public.messages m
     where m.conversation_id = c.id
     order by m.seq desc
     limit 1
  ) last on true
  where (target is null or c.id = target)
    -- A listing that still exists but this person can't see (removed or held) hides its chats
    -- from them, as before; only a listing that is gone for good leaves the chat in place.
    and (c.listing_id is null or l.id is not null)
  order by c.last_message_at desc;
$$;

grant execute on function public.conversation_list(uuid) to authenticated;

-- The admin queue (as before); a conversation report whose listing is gone is still a case.
create or replace function public.admin_review_queue()
returns table (
  kind text,
  target_id uuid,
  status public.moderation_status,
  body text,
  author_handle text,
  author_avatar_url text,
  flag_ref text,
  report_count integer,
  report_reasons text[],
  flagged_at timestamptz,
  context text,
  title text,
  photo_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can review content.' using errcode = '42501';
  end if;

  return query
  select q.*
    from (
      select 'comment'::text as kind,
             c.id as target_id,
             c.moderation_status as status,
             c.body,
             pr.handle as author_handle,
             pr.avatar_url as author_avatar_url,
             c.moderation_ref as flag_ref,
             rep.n::integer as report_count,
             rep.reasons as report_reasons,
             coalesce(c.moderated_at, c.created_at) as flagged_at,
             null::text as context,
             null::text as title,
             null::text as photo_path
        from public.comments c
        join public.profiles pr on pr.id = c.author_id
       cross join lateral (
         select count(*) as n,
                coalesce(array_agg(distinct r.reason::text), '{}'::text[]) as reasons
           from public.comment_reports r
          where r.comment_id = c.id
            and r.created_at > public.review_cutoff('comment', c.id)
       ) rep
       where c.deleted_at is null
         and c.moderation_status <> 'removed'
         and (
           c.moderation_status = 'held'
           or (c.moderation_status = 'pending' and c.created_at < now() - interval '10 minutes')
           or rep.n > 0
         )

      union all

      select 'post'::text,
             p.id,
             p.moderation_status,
             btrim(p.title || E'\n' || p.body),
             pr.handle,
             pr.avatar_url,
             p.moderation_ref,
             0,
             '{}'::text[],
             coalesce(p.moderated_at, p.created_at),
             null::text,
             null::text,
             p.photo_path
        from public.feed_posts p
        join public.profiles pr on pr.id = p.owner_id
       where p.moderation_status = 'held'
          or (p.moderation_status = 'pending' and p.created_at < now() - interval '10 minutes')

      union all

      select 'hanap'::text,
             h.id,
             h.moderation_status,
             h.body,
             pr.handle,
             pr.avatar_url,
             h.moderation_ref,
             0,
             '{}'::text[],
             coalesce(h.moderated_at, h.created_at),
             null::text,
             null::text,
             null::text
        from public.hanap_posts h
        join public.profiles pr on pr.id = h.author_id
       where h.moderation_status = 'held'
          or (h.moderation_status = 'pending' and h.created_at < now() - interval '10 minutes')

      union all

      -- A listing's words are its title and description. `flagged_at` is when it was held or went
      -- back to be screened (`prepare_listing` stamps that on an edit), else when it was made.
      select 'listing'::text,
             l.id,
             l.moderation_status,
             l.description,
             pr.handle,
             pr.avatar_url,
             l.moderation_ref,
             0,
             '{}'::text[],
             coalesce(l.moderated_at, l.created_at),
             'Asking ₱' || to_char(l.asking_php, 'FM999,999,999')
               || ' · ' || replace(l.category, '_', ' ')
               || ' · ' || replace(l.condition, '_', ' ')
               || ' · ' || replace(l.area, '-', ' '),
             l.title,
             l.photo_path
        from public.listings l
        join public.profiles pr on pr.id = l.seller_id
       where l.status <> 'removed'
         and (
           l.moderation_status = 'held'
           or (
             l.moderation_status = 'pending'
             and coalesce(l.moderated_at, l.created_at) < now() - interval '10 minutes'
           )
         )

      union all

      -- A conversation is private, so an admin sees who reported whom and why, not the messages.
      -- The person shown is the one the latest open report is about.
      select 'conversation'::text,
             cv.id,
             null::public.moderation_status,
             ''::text,
             reported.handle,
             reported.avatar_url,
             null::text,
             rep.n::integer,
             rep.reasons,
             rep.first_at,
             'About ' || coalesce('"' || l.title || '"', 'a deleted listing') || ', reported by @' || reporter.handle,
             null::text,
             null::text
        from public.conversations cv
        left join public.listings l on l.id = cv.listing_id
       cross join lateral (
         select count(*) as n,
                array_agg(distinct r.reason) as reasons,
                min(r.created_at) as first_at,
                (array_agg(r.reporter_id order by r.created_at desc))[1] as reporter_id
           from public.conversation_reports r
          where r.conversation_id = cv.id
            and r.created_at > public.review_cutoff('conversation', cv.id)
       ) rep
        join public.profiles reporter on reporter.id = rep.reporter_id
        join public.profiles reported
          on reported.id = case when rep.reporter_id = cv.buyer_id then cv.seller_id else cv.buyer_id end
       where rep.n > 0
    ) q
   order by q.report_count desc, q.flagged_at asc
   limit 200;
end;
$$;
