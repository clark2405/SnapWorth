-- The flip tracker and Collections, stored with History. Both were kept on the phone only, "until
-- History is stored in Supabase"; now it is, they move into the account too. Private: only their
-- owner can see or change them.
--
-- * What someone paid for a thing is a column on its scan. It's the owner's own note: never copy
--   it into anything others can read (a listing, a post). They choose to show it on a shared
--   picture, which the app draws on the phone.
-- * A collection is a named set of the owner's scans: `collections`, and `collection_items` for
--   which scans are in which. A scan can be in any number of collections; deleting the scan takes
--   it out of them, and deleting a collection leaves the scans in History.

-- ---------------------------------------------------------------------------------------------
-- What was paid
-- ---------------------------------------------------------------------------------------------

-- In whole pesos. ₱0 is a price too (a gift, a find); past ₱10,000,000 it's a typo.
alter table public.scan_history
  add column paid_php integer check (paid_php is null or paid_php between 0 and 10000000);

comment on column public.scan_history.paid_php is
  'What the owner paid for it, for the flip tracker. Private to the owner; never copy it anywhere others can read.';

-- A scan saved offline can carry its price when it's finally sent; after that, the owner changes
-- it (or clears it with null). The row's own policies already keep it to the owner.
grant insert (paid_php), update (paid_php) on public.scan_history to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------------------------

create table public.collections (
  -- The app makes the id, so a new collection can be opened before it's saved.
  id uuid primary key default gen_random_uuid(),
  -- Always the person signed in: a client never chooses it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- As the app tidies it: trimmed, 1 to 40 characters.
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  created_at timestamptz not null default now()
);

comment on table public.collections is 'Each person''s named sets of their saved scans. Private to the owner.';

create index collections_user_created_idx on public.collections (user_id, created_at);

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  scan_id uuid not null references public.scan_history (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, scan_id)
);

comment on table public.collection_items is 'Which of a person''s scans are in which of their collections.';

create index collection_items_scan_idx on public.collection_items (scan_id);
create index collection_items_user_added_idx on public.collection_items (user_id, added_at);

-- Flood limits: at most 30 new collections an hour and 100 in all, and 300 things put into
-- collections an hour, per account. A collection can't hold more than the account's scans.
create function public.enforce_collections_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.collections c
     where c.user_id = new.user_id
       and c.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'You are making collections too quickly. Try again in a while.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.collections c where c.user_id = new.user_id) >= 100 then
    raise exception 'You have 100 collections. Delete one you no longer need first.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger collections_enforce_rate_limit
  before insert on public.collections
  for each row execute function public.enforce_collections_rate_limit();

create function public.enforce_collection_items_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.collection_items i
     where i.user_id = new.user_id
       and i.added_at > now() - interval '1 hour'
  ) >= 300 then
    raise exception 'You are changing collections too quickly. Try again in a while.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger collection_items_enforce_rate_limit
  before insert on public.collection_items
  for each row execute function public.enforce_collection_items_rate_limit();

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

create policy "People see their own collections"
  on public.collections for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "People make their own collections"
  on public.collections for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "People rename their own collections"
  on public.collections for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "People delete their own collections"
  on public.collections for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "People see what's in their own collections"
  on public.collection_items for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Only one's own scans, into one's own collections.
create policy "People put their own scans in their own collections"
  on public.collection_items for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.collections c
       where c.id = collection_id and c.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.scan_history s
       where s.id = scan_id and s.user_id = (select auth.uid())
    )
  );

create policy "People take things out of their own collections"
  on public.collection_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Column-level grants back the policies up: signed-out visitors get nothing, the owner is
-- always the caller, a collection's name is all that changes, and a thing is put in or taken
-- out rather than moved.
revoke all on public.collections, public.collection_items from anon, authenticated;
grant select, delete on public.collections, public.collection_items to authenticated;
grant insert (id, name) on public.collections to authenticated;
grant update (name) on public.collections to authenticated;
grant insert (collection_id, scan_id) on public.collection_items to authenticated;
