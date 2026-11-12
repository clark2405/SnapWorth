-- Feed and votes: real community price-check posts (from a saved scan or a marketplace listing),
-- moderation columns on `public.feed_posts`, public read access to scan photos of approved posts,
-- and `public.votes` (one vote per person per post, keeping post vote tallies and linked listing
-- verdicts in sync).
--
-- * Never copy `scan_history.paid_php` onto a feed post: what the owner paid is private to them.
-- * A post's `estimate_php` is the AI estimate the community judges, so the author can't write it:
--   `prepare_feed_post` copies it from the reposted listing, or else the linked scan, and leaves it
--   null when the post has neither. Only a caller with no signed-in user (service role, seeds) can
--   set it.
-- * Public posts are fail-closed: a new post starts `pending` and is visible only to its author
--   until `moderate-content` marks it `approved`.

-- ---------------------------------------------------------------------------------------------
-- Expand `public.feed_posts`
-- ---------------------------------------------------------------------------------------------

alter table public.feed_posts
  alter column owner_id set default auth.uid(),
  alter column estimate_php drop not null,
  add column title text not null default '' check (char_length(title) <= 200),
  add column category text
    check (category is null or category in ('collectibles', 'fashion', 'sneakers', 'electronics', 'home')),
  add column scan_id uuid references public.scan_history (id) on delete set null,
  add column listing_id uuid references public.listings (id) on delete set null,
  add column photo_path text,
  add column moderation_ref text,
  add column moderated_at timestamptz,
  add column too_high_count integer not null default 0 check (too_high_count >= 0),
  add column just_right_count integer not null default 0 check (just_right_count >= 0),
  add column too_low_count integer not null default 0 check (too_low_count >= 0),
  add constraint feed_posts_photo_path_check
    check (
      photo_path is null
      or (scan_id is not null and photo_path = owner_id::text || '/' || scan_id::text || '.jpg')
    );

create index feed_posts_approved_created_idx
  on public.feed_posts (created_at desc)
  where moderation_status = 'approved';
create index feed_posts_owner_created_idx on public.feed_posts (owner_id, created_at desc);
create index feed_posts_listing_idx on public.feed_posts (listing_id) where listing_id is not null;
create index feed_posts_scan_idx on public.feed_posts (scan_id) where scan_id is not null;

-- Tidies the question and title, generates a stable slug when omitted, checks that any linked scan
-- or listing belongs to the post's author, and takes the estimate from that scan or listing.
create function public.prepare_feed_post()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  short_id text;
  scan_amount integer;
  listing_estimate integer;
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
    end if;

    if new.listing_id is not null then
      select l.estimate_php
        into listing_estimate
        from public.listings l
       where l.id = new.listing_id
         and l.seller_id = new.owner_id;
      if not found then
        raise exception 'A feed post can only repost one of your own listings.'
          using errcode = '23514';
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

create trigger feed_posts_prepare
  before insert or update on public.feed_posts
  for each row execute function public.prepare_feed_post();

-- Flood limit: at most 10 feed posts an hour per account.
create function public.enforce_feed_posts_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.feed_posts p
     where p.owner_id = new.owner_id
       and p.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'You are posting too quickly. Try again in a while.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger feed_posts_enforce_rate_limit
  before insert on public.feed_posts
  for each row execute function public.enforce_feed_posts_rate_limit();

create policy "Signed-in users publish their own posts, pending moderation"
  on public.feed_posts for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and moderation_status = 'pending'
    and moderation_ref is null
    and moderated_at is null
  );

create policy "Owners delete their own posts"
  on public.feed_posts for delete
  to authenticated
  using (owner_id = (select auth.uid()));

grant insert (
  id,
  slug,
  title,
  body,
  category,
  scan_id,
  listing_id,
  photo_path
) on public.feed_posts to authenticated;

grant delete on public.feed_posts to authenticated;

-- Allow `comment_thread` to look up a post by either its slug or its UUID.
create or replace function public.comment_thread(post_slug text)
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
  where p.slug = post_slug or p.id::text = post_slug
  order by c.created_at desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- Scan photos of approved feed posts: readable by everyone once moderation approves the post
-- ---------------------------------------------------------------------------------------------

create policy "People see scan photos of approved feed posts"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'scan-photos'
    and exists (
      select 1
        from public.feed_posts p
       where p.photo_path = storage.objects.name
         and p.moderation_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Votes (`public.votes`): one vote per person per post, keeping tallies in sync
-- ---------------------------------------------------------------------------------------------

create type public.vote_choice as enum ('too_high', 'just_right', 'too_low');

create table public.votes (
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  choice public.vote_choice not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.votes is 'Each signed-in person''s price verdict on a feed post.';

create index votes_user_updated_idx on public.votes (user_id, updated_at desc);

create function public.touch_vote_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger votes_touch_updated_at
  before update on public.votes
  for each row execute function public.touch_vote_updated_at();

-- Flood limit: at most 120 new votes cast in an hour per account.
create function public.enforce_votes_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.votes v
     where v.user_id = new.user_id
       and v.created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception 'You are voting too quickly. Try again in a while.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger votes_enforce_rate_limit
  before insert on public.votes
  for each row execute function public.enforce_votes_rate_limit();

-- Works out a listing's community verdict from the votes on every approved post that reposts it:
-- the choice with the most votes (just right wins a tie) and its share of all the votes. With no
-- votes the verdict is null, so a new listing never shows a verdict nobody gave. Not callable by
-- clients: the vote and post triggers below run it.
create function public.refresh_listing_verdict(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  too_high bigint;
  just_right bigint;
  too_low bigint;
  total bigint;
  top_choice text;
  top_count bigint;
begin
  if target is null then
    return;
  end if;

  select coalesce(sum(p.too_high_count), 0),
         coalesce(sum(p.just_right_count), 0),
         coalesce(sum(p.too_low_count), 0)
    into too_high, just_right, too_low
    from public.feed_posts p
   where p.listing_id = target
     and p.moderation_status = 'approved';
  total := too_high + just_right + too_low;

  if total = 0 then
    update public.listings l
       set verdict = null,
           verdict_share = null
     where l.id = target
       and (l.verdict is not null or l.verdict_share is not null);
    return;
  end if;

  top_choice := 'just_right';
  top_count := just_right;
  if too_high > top_count then
    top_choice := 'too_high';
    top_count := too_high;
  end if;
  if too_low > top_count then
    top_choice := 'too_low';
    top_count := too_low;
  end if;

  update public.listings l
     set verdict = top_choice,
         verdict_share = round((top_count::numeric / total::numeric) * 100)::integer
   where l.id = target;
end;
$$;

revoke all on function public.refresh_listing_verdict(uuid) from public, anon, authenticated;

-- Adjusts the post's vote counters and refreshes the verdict of the listing it reposts.
create function public.sync_post_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_post_id uuid := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  dh integer := 0;
  dr integer := 0;
  dl integer := 0;
  post_listing uuid;
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    if old.choice = 'too_high' then dh := dh - 1;
    elsif old.choice = 'just_right' then dr := dr - 1;
    elsif old.choice = 'too_low' then dl := dl - 1;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.choice = 'too_high' then dh := dh + 1;
    elsif new.choice = 'just_right' then dr := dr + 1;
    elsif new.choice = 'too_low' then dl := dl + 1;
    end if;
  end if;

  if dh = 0 and dr = 0 and dl = 0 then
    return coalesce(new, old);
  end if;

  update public.feed_posts p
     set too_high_count = greatest(0, p.too_high_count + dh),
         just_right_count = greatest(0, p.just_right_count + dr),
         too_low_count = greatest(0, p.too_low_count + dl)
   where p.id = target_post_id
   returning p.listing_id into post_listing;

  if found then
    perform public.refresh_listing_verdict(post_listing);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger votes_sync_post_counts
  after insert or update or delete on public.votes
  for each row execute function public.sync_post_vote_counts();

alter table public.votes enable row level security;

create policy "Voters see their own votes"
  on public.votes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Signed-in users cast votes as themselves on visible posts"
  on public.votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.feed_posts p
       where p.id = post_id
         and (p.moderation_status = 'approved' or p.owner_id = (select auth.uid()))
    )
  );

create policy "Voters change their own votes"
  on public.votes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Voters withdraw their own votes"
  on public.votes for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.votes from anon, authenticated;
grant select on public.votes to authenticated;
grant insert (post_id, choice) on public.votes to authenticated;
grant update (choice) on public.votes to authenticated;
grant delete on public.votes to authenticated;

-- A listing's verdict follows its posts: when a post is approved, held or deleted, the votes it
-- carries start or stop counting.
create function public.refresh_verdict_for_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_listing_verdict(case when tg_op = 'DELETE' then old.listing_id else new.listing_id end);
  return null;
end;
$$;

create trigger feed_posts_refresh_verdict_on_moderation
  after update of moderation_status on public.feed_posts
  for each row
  when (old.moderation_status is distinct from new.moderation_status)
  execute function public.refresh_verdict_for_post();

create trigger feed_posts_refresh_verdict_on_delete
  after delete on public.feed_posts
  for each row execute function public.refresh_verdict_for_post();
