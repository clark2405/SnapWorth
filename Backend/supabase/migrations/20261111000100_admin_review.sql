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
-- Sources today: comments, feed posts, hanap posts and reported conversations. Listings join when
-- they have moderation columns: add a select for them to `admin_review_queue`, a branch for them
-- to `admin_review_decide`, and to its `tbl` case. Nothing else needs to change.

-- ---------------------------------------------------------------------------------------------
-- The record of every decision.
-- ---------------------------------------------------------------------------------------------

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  -- 'comment', 'post', 'hanap' or 'conversation'; `admin_review_decide` is what checks it.
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
-- reports, or a conversation with open reports. Removed content is out of the queue.
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
  context text
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
             null::text as context
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
             null::text
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
             null::text
        from public.hanap_posts h
        join public.profiles pr on pr.id = h.author_id
       where h.moderation_status = 'held'
          or (h.moderation_status = 'pending' and h.created_at < now() - interval '10 minutes')

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
             'About "' || l.title || '", reported by @' || reporter.handle
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
--   remove:  takes content down for good, and closes its reports;
--   dismiss: closes the open reports and leaves the content as it is (the only decision for a
--            conversation, whose messages stay private).
-- Content already removed is out of reach, and so is dismissing when nothing is reported.
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
    end;
    if tbl is null then
      raise exception 'That is not something to review.' using errcode = '22023';
    end if;

    execute format(
      'select moderation_status from public.%I where id = $1%s for update',
      tbl,
      case when item_kind = 'comment' then ' and deleted_at is null' else '' end
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
  end if;

  insert into public.moderation_log (kind, target_id, decision, decided_by)
  values (item_kind, item_id, decision, caller);
end;
$$;

revoke all on function public.admin_review_decide(text, uuid, text) from public, anon;
grant execute on function public.admin_review_decide(text, uuid, text) to authenticated;
