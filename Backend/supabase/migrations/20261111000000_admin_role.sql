-- Who may review held content. An admin is a row in `public.admins`, and only the database
-- owner can write one: the dashboard's SQL editor, a migration or the service role. The app can
-- neither read the table nor change it, and nothing a person controls grants the role: not their
-- sign-up metadata, not their email address. The app asks `is_admin()` and nothing else.
--
-- To make someone an admin, run this in the dashboard's SQL editor (see agents/READ-FIRST.md):
--   insert into public.admins (user_id) select id from auth.users where email = 'them@example.com';

create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now()
);

comment on table public.admins is
  'Accounts that may review held content. Written only by the database owner or service role.';

-- Row-level security with no policy, and no grants: no client role can read or write it.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Whether the caller is an admin. Security definer so it can read the table the caller can't.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.admins a
     where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
