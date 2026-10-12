-- Feed discussion: public profiles, feed posts, comments with one level of replies, and
-- reports. Visibility is enforced here with row-level security, so it holds no matter what a
-- client sends. Public content is fail-closed: a comment is visible to other people only once
-- moderation has approved it; its author always sees their own pending or held comment.

create type public.moderation_status as enum ('pending', 'approved', 'held', 'removed');
create type public.report_reason as enum (
  'spam',
  'harassment',
  'prohibited_item',
  'misleading',
  'other'
);

-- ---------------------------------------------------------------------------------------------
-- Profiles: the public face of an account (handle and avatar), one per auth user.
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile for each account: handle and avatar only.';

-- Every new account (including anonymous ones) gets a profile. The handle comes from sign-up
-- metadata when provided, otherwise a stable one derived from the user id.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(
      nullif(lower(new.raw_user_meta_data ->> 'handle'), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 10)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Feed posts: the minimum the discussion needs. `slug` is the stable public key used in links.
-- ---------------------------------------------------------------------------------------------

create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  estimate_php integer not null check (estimate_php >= 0),
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Comments and replies.
-- ---------------------------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  -- A reply points at a top-level comment on the same post; threads are one level deep.
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  moderation_status public.moderation_status not null default 'pending',
  moderation_ref text,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_not_own_parent check (parent_id is null or parent_id <> id)
);

create index comments_post_created_idx on public.comments (post_id, created_at desc);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_created_idx on public.comments (author_id, created_at desc);

-- Trims the body, and keeps threads one level deep and on one post. A reply to a reply attaches
-- to the top-level comment it belongs to, so "reply" always works from anywhere in a thread.
create function public.enforce_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_post uuid;
  parent_parent uuid;
begin
  new.body := btrim(new.body);
  if new.parent_id is null then
    return new;
  end if;

  select c.post_id, c.parent_id
    into parent_post, parent_parent
    from public.comments c
   where c.id = new.parent_id
     and c.deleted_at is null;

  if not found then
    raise exception 'The comment you are replying to is not available.'
      using errcode = 'P0002';
  end if;
  if parent_post <> new.post_id then
    raise exception 'A reply must be on the same post as its parent.' using errcode = '22023';
  end if;
  if parent_parent is not null then
    new.parent_id := parent_parent;
  end if;
  return new;
end;
$$;

create trigger comments_enforce_parent
  before insert on public.comments
  for each row execute function public.enforce_comment_parent();

-- A light flood limit: at most 10 comments a minute per account.
create function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.comments c
     where c.author_id = new.author_id
       and c.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'You are commenting too quickly. Try again in a minute.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger comments_enforce_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ---------------------------------------------------------------------------------------------
-- Reports. Three distinct reports on an approved comment hold it for review automatically.
-- ---------------------------------------------------------------------------------------------

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason public.report_reason not null default 'other',
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create function public.hold_heavily_reported_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.comment_reports r where r.comment_id = new.comment_id) >= 3 then
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

create trigger comment_reports_hold_threshold
  after insert on public.comment_reports
  for each row execute function public.hold_heavily_reported_comment();

-- ---------------------------------------------------------------------------------------------
-- Row-level security.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.feed_posts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Approved posts are public; owners see their own"
  on public.feed_posts for select
  to anon, authenticated
  using (moderation_status = 'approved' or owner_id = (select auth.uid()));

create policy "Approved comments are public; authors see their own"
  on public.comments for select
  to anon, authenticated
  using (
    deleted_at is null
    and (
      author_id = (select auth.uid())
      or (
        moderation_status = 'approved'
        and exists (
          select 1
            from public.feed_posts p
           where p.id = post_id
             and p.moderation_status = 'approved'
        )
      )
    )
  );

-- Clients may only add their own, unmoderated comment to a post they can see. Moderation fields
-- and deletion are never writable from a client; see the functions below.
create policy "Signed-in users comment as themselves, pending moderation"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and moderation_status = 'pending'
    and moderation_ref is null
    and moderated_at is null
    and deleted_at is null
    and exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "Users report other people's visible comments"
  on public.comment_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
        from public.comments c
       where c.id = comment_id
         and c.author_id <> (select auth.uid())
    )
  );

create policy "Users see their own reports"
  on public.comment_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- Column-level grants back the policies up: a client can never set moderation or deletion
-- fields, even on its own insert.
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
-- `id` is client-assignable so a retried submit is idempotent (a resend conflicts, not doubles).
grant insert (id, post_id, parent_id, body) on public.comments to authenticated;

revoke all on public.comment_reports from anon, authenticated;
-- anon may query (the thread checks "reported by me"), but no policy grants it any rows.
grant select on public.comment_reports to anon, authenticated;
grant insert (comment_id, reason) on public.comment_reports to authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

revoke all on public.feed_posts from anon, authenticated;
grant select on public.feed_posts to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Functions clients call.
-- ---------------------------------------------------------------------------------------------

-- Soft-deletes the caller's own comment. Replies to it stay, under a "deleted" placeholder.
create function public.delete_own_comment(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments
     set deleted_at = now()
   where id = target
     and author_id = (select auth.uid())
     and deleted_at is null;
  return found;
end;
$$;

revoke all on function public.delete_own_comment(uuid) from public, anon;
grant execute on function public.delete_own_comment(uuid) to authenticated;

-- The thread for one post, as the caller is allowed to see it, with each author's public
-- profile. `parent_hidden` marks replies whose parent the caller can no longer see (deleted or
-- held), so the app can show a placeholder instead of dropping the reply.
create function public.comment_thread(post_slug text)
returns table (
  id uuid,
  parent_id uuid,
  parent_hidden boolean,
  body text,
  moderation_status public.moderation_status,
  created_at timestamptz,
  author_id uuid,
  author_handle text,
  author_avatar_url text,
  is_mine boolean,
  reported_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.parent_id,
    c.parent_id is not null
      and not exists (select 1 from public.comments v where v.id = c.parent_id) as parent_hidden,
    c.body,
    c.moderation_status,
    c.created_at,
    c.author_id,
    pr.handle,
    pr.avatar_url,
    c.author_id = (select auth.uid()) as is_mine,
    exists (
      select 1
        from public.comment_reports r
       where r.comment_id = c.id
         and r.reporter_id = (select auth.uid())
    ) as reported_by_me
  from public.comments c
  join public.feed_posts p on p.id = c.post_id
  join public.profiles pr on pr.id = c.author_id
  where p.slug = post_slug
  order by c.created_at desc;
$$;

grant execute on function public.comment_thread(text) to anon, authenticated;
