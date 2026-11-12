-- The admin review queue: what moderation has held, and what people have reported, in one list
-- an admin can act on. Content that isn't public is invisible to everyone but its author, so the
-- queue is read, and every decision made, through the two security definer functions below. Both
-- check `is_admin()` first, so a signed-out visitor or an ordinary account is refused at the
-- database whatever the app shows.
--
-- Each decision is written to `public.moderation_log` (who, what and when), which no client
-- role can read or write. A decision also closes the target's open reports: a report is open
-- until the target's latest approve, remove or dismiss, so a fresh report after one starts a new
-- case. Holding content leaves its reports open.
--
-- Sources today: comments, feed posts, hanap posts, listings and reported conversations. To add
-- another source that has moderation columns, add a select for it to `admin_review_queue`, and
-- its table to `admin_review_decide`'s `tbl` case. Nothing else needs to change.
--
-- Listings are the one source whose decision also touches something other than moderation:
-- removing one sets its `status` to 'removed' as well, which is what closes its chats (see
-- `admin_review_decide`). The queue and the decision run as the function's owner, so the listing
-- triggers (`guard_listing_fields`, which only judges the `anon` and `authenticated` roles, and
-- `prepare_listing`, which only acts when a listing's words change) don't stand in their way.
--
-- A held or pending listing's photo is in the private `scan-photos` bucket, so the end of this
-- file lets an admin, and only an admin, read the photos of listings and posts that wait here.

-- ---------------------------------------------------------------------------------------------
-- The record of every decision.
-- ---------------------------------------------------------------------------------------------

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  -- 'comment', 'post', 'hanap', 'listing' or 'conversation'; `admin_review_decide` checks it.
  kind text not null,
  target_id uuid not null,
  decision text not null check (decision in ('approve', 'hold', 'remove', 'dismiss')),
  -- No foreign key on purpose: the record of a decision outlives the admin's account.
  decided_by uuid not null,
  decided_at timestamptz not null default now()
);

comment on table public.moderation_log is
  'Who decided what about moderated content, and when. Written only by admin_review_decide.';

create index moderation_log_target_idx
  on public.moderation_log (kind, target_id, decided_at desc);

alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;

-- When a target's open reports begin: just after its latest decision that closes them. Only the
-- functions below call this, as their owner.
create function public.review_cutoff(item_kind text, item_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(max(l.decided_at), '-infinity'::timestamptz)
    from public.moderation_log l
   where l.kind = item_kind
     and l.target_id = item_id
     and l.decision in ('approve', 'remove', 'dismiss');
$$;

revoke all on function public.review_cutoff(text, uuid) from public, anon, authenticated;

-- Three open reports hold an approved comment for review. Reports an admin has already decided
-- on no longer count, or one new report on a comment they approved would hold it again.
create or replace function public.hold_heavily_reported_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.comment_reports r
     where r.comment_id = new.comment_id
       and r.created_at > public.review_cutoff('comment', new.comment_id)
  ) >= 3 then
    update public.comments
       set moderation_status = 'held',
           moderation_ref = 'community-reports',
           moderated_at = now()
     where id = new.comment_id
       and moderation_status = 'approved';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The queue.
-- ---------------------------------------------------------------------------------------------

-- Everything an admin should look at, most reported first, then oldest. A case is content that is
-- held, content still pending after ten minutes (moderation never finished), content with open
-- reports, or a conversation with open reports. Removed content is out of the queue, and so is a
-- listing its seller took down. `title` is a listing's, and `photo_path` the photo of a listing or
-- a post in the private `scan-photos` bucket (the app signs a link for it as the admin).
create function public.admin_review_queue()
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
             'About "' || l.title || '", reported by @' || reporter.handle,
             null::text,
             null::text
        from public.conversations cv
        join public.listings l on l.id = cv.listing_id
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

revoke all on function public.admin_review_queue() from public, anon;
grant execute on function public.admin_review_queue() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Decisions.
-- ---------------------------------------------------------------------------------------------

-- Decides one case, as the signed-in admin:
--   approve: makes content public, and closes its reports;
--   hold:    hides content for a closer look, leaving its reports open;
--   remove:  takes content down for good, and closes its reports. A listing is also set to
--            'removed': its chats close (nobody can message into them), the seller sees it as
--            removed and can delete it but not edit it, and buyers stop seeing it and its chats;
--   dismiss: closes the open reports and leaves the content as it is (the only decision for a
--            conversation, whose messages stay private).
-- Content already removed is out of reach, and so is dismissing when nothing is reported. Holding
-- a listing hides it from buyers too, including those already in a chat about it (their chat
-- reappears if it is approved); the seller still sees it, marked held, and a held listing is not
-- screened again when its words change.
create function public.admin_review_decide(item_kind text, item_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  tbl text;
  was public.moderation_status;
  open_reports integer := 0;
begin
  if caller is null or not public.is_admin() then
    raise exception 'Only admins can review content.' using errcode = '42501';
  end if;
  if decision not in ('approve', 'hold', 'remove', 'dismiss') then
    raise exception 'That is not a decision.' using errcode = '22023';
  end if;

  if item_kind = 'conversation' then
    if decision <> 'dismiss' then
      raise exception 'A conversation''s reports can only be dismissed.' using errcode = '22023';
    end if;
    perform 1 from public.conversations cv where cv.id = item_id for update;
    if not found then
      raise exception 'That case is not available.' using errcode = 'P0002';
    end if;
    select count(*) into open_reports
      from public.conversation_reports r
     where r.conversation_id = item_id
       and r.created_at > public.review_cutoff('conversation', item_id);
  else
    tbl := case item_kind
      when 'comment' then 'comments'
      when 'post' then 'feed_posts'
      when 'hanap' then 'hanap_posts'
      when 'listing' then 'listings'
    end;
    if tbl is null then
      raise exception 'That is not something to review.' using errcode = '22023';
    end if;

    execute format(
      'select moderation_status from public.%I where id = $1%s for update',
      tbl,
      case item_kind
        when 'comment' then ' and deleted_at is null'
        -- A listing its seller removed is not a case either.
        when 'listing' then ' and status <> ''removed'''
        else ''
      end
    ) into was using item_id;
    if was is null or was = 'removed' then
      raise exception 'That case is not available.' using errcode = 'P0002';
    end if;

    if item_kind = 'comment' then
      select count(*) into open_reports
        from public.comment_reports r
       where r.comment_id = item_id
         and r.created_at > public.review_cutoff('comment', item_id);
    end if;
  end if;

  if decision = 'dismiss' then
    if open_reports = 0 then
      raise exception 'There are no open reports to dismiss.' using errcode = '22023';
    end if;
  else
    execute format(
      'update public.%I set moderation_status = $1::public.moderation_status, moderation_ref = $2, moderated_at = now() where id = $3',
      tbl
    ) using
      case decision when 'approve' then 'approved' when 'hold' then 'held' else 'removed' end,
      'admin:' || caller::text,
      item_id;
    if item_kind = 'listing' and decision = 'remove' then
      update public.listings set status = 'removed' where id = item_id;
    end if;
  end if;

  insert into public.moderation_log (kind, target_id, decision, decided_by)
  values (item_kind, item_id, decision, caller);
end;
$$;

revoke all on function public.admin_review_decide(text, uuid, text) from public, anon;
grant execute on function public.admin_review_decide(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Photos of what waits for review.
-- ---------------------------------------------------------------------------------------------

-- A photo on a listing or a feed post sits in the private `scan-photos` bucket, readable only by
-- its owner until the content is approved, so an admin deciding on held content would be judging
-- the words of a post without seeing what it shows. This lets an admin, and only an admin, read
-- the photo of a listing or post that is held or still pending: the content people have put up to
-- be public. It reaches no other scan photo, and nothing once content is removed. Policies are
-- OR'd with the owner's and the public ones, so those stay as they are.
--
-- The check is a function because a policy's own subqueries run as the reader, and the reader's
-- row-level security hides a held listing or post from everyone but its author, an admin included.
create function public.admin_may_see_photo(photo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
     and (
       exists (
         select 1
           from public.listings l
          where l.photo_path = photo
            and l.status <> 'removed'
            and l.moderation_status in ('pending', 'held')
       )
       or exists (
         select 1
           from public.feed_posts p
          where p.photo_path = photo
            and p.moderation_status in ('pending', 'held')
       )
     );
$$;

revoke all on function public.admin_may_see_photo(text) from public, anon;
grant execute on function public.admin_may_see_photo(text) to authenticated;

create policy "Admins see photos of listings and posts waiting for review"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scan-photos'
    and public.admin_may_see_photo(storage.objects.name)
  );
