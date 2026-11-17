-- The moderation console: suspending accounts, finding people, and the record of decisions.
--
-- A suspended account can still sign in and look around, but can't put anything new in front of
-- anyone: no posts, comments, listings, hanaps, votes, messages or new chats. A suspension has a
-- reason and either an end or none (until lifted). Suspending can also take down what the
-- account has already published. Every suspension and reinstatement goes in moderation_log.
-- Only admins call these, and an admin can't suspend themself or another admin.

create table public.account_suspensions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  -- Null: until an admin lifts it.
  until timestamptz,
  -- No foreign key: the record outlives the admin's account, as moderation_log does.
  suspended_by uuid not null,
  suspended_at timestamptz not null default now()
);

comment on table public.account_suspensions is
  'Accounts that may not publish, and why. Written only by the admin_* functions.';

alter table public.account_suspensions enable row level security;
revoke all on public.account_suspensions from anon, authenticated;

alter table public.moderation_log drop constraint moderation_log_decision_check;
alter table public.moderation_log
  add constraint moderation_log_decision_check
  check (decision in ('approve', 'hold', 'remove', 'dismiss', 'suspend', 'reinstate'));
alter table public.moderation_log add column note text;

-- Whether an account is suspended right now.
create function public.is_suspended(account uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.account_suspensions s
     where s.user_id = account
       and (s.until is null or s.until > now())
  );
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to authenticated;

-- Refuses anything new from a suspended account. It goes by who is signed in, so one function
-- covers every table whatever its author column is called.
-- Not security definer: it has to see who is calling (is_suspended reads the table for it).
create function public.refuse_suspended_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (select auth.uid()) is not null
     and public.is_suspended((select auth.uid())) then
    raise exception 'Your account is suspended, so you can’t post right now.'
      using errcode = '42501', hint = 'suspended';
  end if;
  return new;
end;
$$;

create trigger feed_posts_refuse_suspended before insert on public.feed_posts
  for each row execute function public.refuse_suspended_account();
create trigger comments_refuse_suspended before insert on public.comments
  for each row execute function public.refuse_suspended_account();
create trigger listings_refuse_suspended before insert or update on public.listings
  for each row execute function public.refuse_suspended_account();
create trigger hanap_posts_refuse_suspended before insert on public.hanap_posts
  for each row execute function public.refuse_suspended_account();
create trigger votes_refuse_suspended before insert or update on public.votes
  for each row execute function public.refuse_suspended_account();
create trigger messages_refuse_suspended before insert on public.messages
  for each row execute function public.refuse_suspended_account();
create trigger conversations_refuse_suspended before insert on public.conversations
  for each row execute function public.refuse_suspended_account();

-- ---------------------------------------------------------------------------------------------
-- Suspending and reinstating.
-- ---------------------------------------------------------------------------------------------

create function public.admin_suspend_account(
  target uuid,
  reason text,
  days integer default null,
  take_down boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not public.is_admin() then
    raise exception 'Only admins can suspend accounts.' using errcode = '42501';
  end if;
  if target = caller then
    raise exception 'You can’t suspend your own account.' using errcode = '22023';
  end if;
  if exists (select 1 from public.admins a where a.user_id = target) then
    raise exception 'Another admin can’t be suspended here.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'That account is not available.' using errcode = 'P0002';
  end if;
  if reason is null or char_length(btrim(reason)) = 0 then
    raise exception 'Say why the account is suspended.' using errcode = '22023';
  end if;
  if days is not null and (days < 1 or days > 3650) then
    raise exception 'A suspension lasts 1 to 3650 days, or until lifted.' using errcode = '22023';
  end if;

  insert into public.account_suspensions as s (user_id, reason, until, suspended_by)
  values (
    target,
    left(btrim(reason), 300),
    case when days is null then null else now() + make_interval(days => days) end,
    caller
  )
  on conflict (user_id) do update
    set reason = excluded.reason,
        until = excluded.until,
        suspended_by = excluded.suspended_by,
        suspended_at = now();

  if take_down then
    update public.feed_posts
       set moderation_status = 'removed', moderation_ref = 'admin:suspended', moderated_at = now()
     where owner_id = target and moderation_status <> 'removed';
    update public.comments
       set moderation_status = 'removed', moderation_ref = 'admin:suspended', moderated_at = now()
     where author_id = target and moderation_status <> 'removed';
    update public.listings
       set moderation_status = 'removed', moderation_ref = 'admin:suspended', moderated_at = now()
     where seller_id = target and moderation_status <> 'removed';
    update public.hanap_posts
       set moderation_status = 'removed', moderation_ref = 'admin:suspended', moderated_at = now()
     where author_id = target and moderation_status <> 'removed';
  end if;

  insert into public.moderation_log (kind, target_id, decision, decided_by, note)
  values (
    'account',
    target,
    'suspend',
    caller,
    left(btrim(reason), 300)
      || case when days is null then ' (until lifted)' else format(' (%s days)', days) end
      || case when take_down then '; their content taken down' else '' end
  );
end;
$$;

create function public.admin_reinstate_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not public.is_admin() then
    raise exception 'Only admins can reinstate accounts.' using errcode = '42501';
  end if;
  delete from public.account_suspensions where user_id = target;
  if not found then
    raise exception 'That account isn’t suspended.' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (kind, target_id, decision, decided_by)
  values ('account', target, 'reinstate', caller);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Finding people, the record of decisions, and the overview.
-- ---------------------------------------------------------------------------------------------

-- People matching a search (handle or name), or with nothing to search the most reported first.
create function public.admin_find_people(search text default null)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  post_count integer,
  comment_count integer,
  listing_count integer,
  reports_against integer,
  removed_count integer,
  suspended boolean,
  suspended_until timestamptz,
  suspension_reason text,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  term text := nullif(btrim(coalesce(search, '')), '');
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can look people up.' using errcode = '42501';
  end if;
  return query
  with people as (
    select
      p.id as person_id,
      p.handle as person_handle,
      p.display_name as person_name,
      p.avatar_url as person_avatar,
      p.created_at as person_joined,
      (select count(*)::integer from public.feed_posts f where f.owner_id = p.id) as posts,
      (select count(*)::integer from public.comments c where c.author_id = p.id) as comment_total,
      (select count(*)::integer from public.listings l where l.seller_id = p.id) as listing_total,
      (
        (select count(*)::integer
           from public.comment_reports r
           join public.comments c on c.id = r.comment_id
          where c.author_id = p.id)
        + (select count(*)::integer
             from public.conversation_reports r
             join public.conversations cv on cv.id = r.conversation_id
            where r.reporter_id <> p.id and p.id in (cv.buyer_id, cv.seller_id))
      ) as reports,
      (
        (select count(*)::integer from public.feed_posts f
          where f.owner_id = p.id and f.moderation_status = 'removed')
        + (select count(*)::integer from public.comments c
            where c.author_id = p.id and c.moderation_status = 'removed')
        + (select count(*)::integer from public.listings l
            where l.seller_id = p.id and l.moderation_status = 'removed')
      ) as removed,
      s.user_id is not null and (s.until is null or s.until > now()) as is_out,
      s.until as out_until,
      s.reason as out_reason,
      exists (select 1 from public.admins a where a.user_id = p.id) as admin
    from public.profiles p
    left join public.account_suspensions s on s.user_id = p.id
    where term is null
       or p.handle ilike '%' || term || '%'
       or p.display_name ilike '%' || term || '%'
  )
  select
    person_id, person_handle, person_name, person_avatar, person_joined, posts, comment_total,
    listing_total, reports, removed, is_out, out_until, out_reason, admin
  from people
  order by reports + removed desc, is_out desc, person_joined desc
  limit 50;
end;
$$;

create function public.admin_moderation_history(max_rows integer default 50)
returns table (
  id uuid,
  kind text,
  target_id uuid,
  decision text,
  note text,
  decided_at timestamptz,
  decided_by_handle text,
  target_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can read the moderation history.' using errcode = '42501';
  end if;
  return query
  select
    m.id,
    m.kind,
    m.target_id,
    m.decision,
    m.note,
    m.decided_at,
    coalesce(d.handle, 'a former admin'),
    case m.kind
      when 'account' then (select '@' || p.handle from public.profiles p where p.id = m.target_id)
      when 'post' then (select left(coalesce(nullif(f.title, ''), f.body), 80)
                          from public.feed_posts f where f.id = m.target_id)
      when 'comment' then (select left(c.body, 80) from public.comments c where c.id = m.target_id)
      when 'listing' then (select l.title from public.listings l where l.id = m.target_id)
      when 'hanap' then (select left(h.body, 80) from public.hanap_posts h where h.id = m.target_id)
      else null
    end
  from public.moderation_log m
  left join public.profiles d on d.id = m.decided_by
  order by m.decided_at desc
  limit greatest(1, least(coalesce(max_rows, 50), 200));
end;
$$;

create function public.admin_overview()
returns table (
  open_cases integer,
  reports_this_week integer,
  suspended_accounts integer,
  new_accounts_this_week integer,
  posts_this_week integer,
  decisions_this_week integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can see the overview.' using errcode = '42501';
  end if;
  return query
  select
    (select count(*)::integer from public.admin_review_queue()),
    (
      (select count(*)::integer from public.comment_reports
        where created_at > now() - interval '7 days')
      + (select count(*)::integer from public.conversation_reports
          where created_at > now() - interval '7 days')
    ),
    (select count(*)::integer from public.account_suspensions
      where until is null or until > now()),
    (select count(*)::integer from public.profiles where created_at > now() - interval '7 days'),
    (select count(*)::integer from public.feed_posts where created_at > now() - interval '7 days'),
    (select count(*)::integer from public.moderation_log
      where decided_at > now() - interval '7 days');
end;
$$;

revoke all on function public.admin_suspend_account(uuid, text, integer, boolean) from public;
revoke all on function public.admin_reinstate_account(uuid) from public;
revoke all on function public.admin_find_people(text) from public;
revoke all on function public.admin_moderation_history(integer) from public;
revoke all on function public.admin_overview() from public;
grant execute on function public.admin_suspend_account(uuid, text, integer, boolean) to authenticated;
grant execute on function public.admin_reinstate_account(uuid) to authenticated;
grant execute on function public.admin_find_people(text) to authenticated;
grant execute on function public.admin_moderation_history(integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;
