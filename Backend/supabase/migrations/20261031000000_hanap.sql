-- Hanap: buyers post what they're looking for ("Nike windbreaker, size M, under ₱1,500"), so
-- sellers know what people want and the buyer can be shown listings that match. A post is
-- public writing, so it's moderated like a comment: it starts pending, only its author sees it
-- until moderate-content approves it, and only approved, open posts are public.

create type public.hanap_status as enum ('open', 'found');

create table public.hanap_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 3 and 140),
  -- The most they'll pay, in whole pesos, when they say.
  max_php integer check (max_php is null or max_php between 1 and 10000000),
  status public.hanap_status not null default 'open',
  moderation_status public.moderation_status not null default 'pending',
  moderation_ref text,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.hanap_posts is
  'What buyers are looking for. Public once approved by moderation and while open.';

create index hanap_posts_open_recent
  on public.hanap_posts (created_at desc)
  where status = 'open' and moderation_status = 'approved';
create index hanap_posts_author on public.hanap_posts (author_id, created_at desc);

-- Tidy the text before the checks see it.
create function public.trim_hanap_body()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.body := btrim(regexp_replace(new.body, '\s+', ' ', 'g'));
  return new;
end;
$$;

create trigger hanap_posts_trim
  before insert on public.hanap_posts
  for each row execute function public.trim_hanap_body();

-- A flood limit: at most 5 posts an hour, and 20 open at once, per account.
create function public.enforce_hanap_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.hanap_posts h
     where h.author_id = new.author_id
       and h.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'You are posting too quickly. Try again in an hour.' using errcode = 'P0001';
  end if;
  if (
    select count(*)
      from public.hanap_posts h
     where h.author_id = new.author_id
       and h.status = 'open'
  ) >= 20 then
    raise exception 'You have 20 open. Close one you''ve found first.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger hanap_posts_enforce_rate_limit
  before insert on public.hanap_posts
  for each row execute function public.enforce_hanap_rate_limit();

alter table public.hanap_posts enable row level security;

create policy "Approved open hanap posts are public; authors see their own"
  on public.hanap_posts for select
  to anon, authenticated
  using (
    (status = 'open' and moderation_status = 'approved')
    or author_id = (select auth.uid())
  );

create policy "Signed-in people post their own hanap"
  on public.hanap_posts for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Authors mark their own hanap found or open"
  on public.hanap_posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own hanap"
  on public.hanap_posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- Column-level grants back the policies up: a client can never set moderation, the author or
-- the time, and can only change whether a post is still open.
revoke all on public.hanap_posts from anon, authenticated;
grant select on public.hanap_posts to anon, authenticated;
grant insert (body, max_php) on public.hanap_posts to authenticated;
grant update (status) on public.hanap_posts to authenticated;
grant delete on public.hanap_posts to authenticated;
