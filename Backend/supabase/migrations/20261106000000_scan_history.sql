-- Scan History: each successful AI estimate a signed-in person saves, with the photo it came
-- from. Private: only its owner can see, change or delete it.
--
-- `photo_uri` is where the photo is on the phone that took it, so it only shows there; uploading
-- photos to Storage is a follow-up.

-- The live project already has a `scan_history` table, made by hand from an early draft of this
-- feature (PR #24's first version) and never recorded as a migration. Its rules let anyone read,
-- and anyone write, a scan without an owner. It was empty when checked on 2026-11-12, so it's
-- replaced by the table below. If it ever holds a row, this stops rather than lose anyone's scan.
do $$
begin
  if to_regclass('public.scan_history') is not null then
    if exists (select 1 from public.scan_history) then
      raise exception 'public.scan_history already exists and holds rows: move them by hand first.';
    end if;
    drop table public.scan_history;
  end if;
end;
$$;

create table public.scan_history (
  -- The app makes the id, so a scan keeps the same one on the phone and here.
  id uuid primary key default gen_random_uuid(),
  -- Always the person signed in: a client never chooses it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_name text not null check (char_length(item_name) between 1 and 200),
  amount_php integer not null check (amount_php >= 0),
  low_php integer not null check (low_php >= 0),
  high_php integer not null check (high_php >= low_php),
  explanation text check (char_length(explanation) <= 2000),
  assumptions jsonb not null default '[]'::jsonb check (jsonb_typeof(assumptions) = 'array'),
  photo_uri text check (char_length(photo_uri) <= 2000),
  status text not null default 'private' check (status in ('listed', 'on_feed', 'private', 'sold')),
  created_at timestamptz not null default now()
);

comment on table public.scan_history is 'Each person''s saved scans and their AI estimates. Private to the owner.';

create index scan_history_user_created_idx on public.scan_history (user_id, created_at desc);

-- A flood limit: at most 60 saved scans an hour per account. Estimates are limited already; this
-- stops rows being written straight to the table.
create function public.enforce_scan_history_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.scan_history s
     where s.user_id = new.user_id
       and s.created_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'You are saving scans too quickly. Try again in a while.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger scan_history_enforce_rate_limit
  before insert on public.scan_history
  for each row execute function public.enforce_scan_history_rate_limit();

alter table public.scan_history enable row level security;

create policy "People see their own scans"
  on public.scan_history for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "People save their own scans"
  on public.scan_history for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "People change their own scans"
  on public.scan_history for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "People delete their own scans"
  on public.scan_history for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Column-level grants back the policies up: signed-out visitors get nothing, the owner is
-- always the caller, and only a scan's status can change once it's saved.
revoke all on public.scan_history from anon, authenticated;
grant select, delete on public.scan_history to authenticated;
grant insert (id, item_name, amount_php, low_php, high_php, explanation, assumptions, photo_uri, status)
  on public.scan_history to authenticated;
grant update (status) on public.scan_history to authenticated;
