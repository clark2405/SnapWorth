-- Scan History: Stores successful AI price estimates and captured photos for users.
-- Visible only to the owner via row-level security.

create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  item_name text not null,
  amount_php integer not null check (amount_php >= 0),
  low_php integer not null check (low_php >= 0),
  high_php integer not null check (high_php >= 0),
  explanation text,
  assumptions jsonb not null default '[]'::jsonb,
  photo_uri text,
  status text not null default 'private' check (status in ('listed', 'on_feed', 'private', 'sold')),
  created_at timestamptz not null default now()
);

comment on table public.scan_history is 'Stores captured scans and their successful AI estimates.';

alter table public.scan_history enable row level security;

create policy "Users can view own scan history"
  on public.scan_history for select
  using (auth.uid() = user_id or user_id is null);

create policy "Users can insert own scan history"
  on public.scan_history for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can update own scan history"
  on public.scan_history for update
  using (auth.uid() = user_id);

create policy "Users can delete own scan history"
  on public.scan_history for delete
  using (auth.uid() = user_id);

create index if not exists idx_scan_history_user_created
  on public.scan_history (user_id, created_at desc);
