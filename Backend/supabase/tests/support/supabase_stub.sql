-- Local-only stand-in for the parts of a Supabase database the migrations rely on: the `auth`
-- schema, `auth.uid()` and `auth.jwt()`, Storage's two tables, and the anon/authenticated/
-- service_role roles with Supabase's default privileges. Used by Backend/scripts/test-db.sh; never
-- applied to a real project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz
);

-- Same contract as Supabase: the caller's user id from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

-- Same contract as Supabase: all of the request's JWT claims (`sub`, `role`, `iss`, …).
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

-- A STUB of Supabase Storage's tables, only as much as the migrations' buckets and policies use.
-- The real schema belongs to the Storage service and has more columns, functions and triggers.
-- Storage's API writes and reads `storage.objects` as the caller's role, so its row-level
-- security policies decide every upload, download, signed link and delete; a test plays the API
-- by inserting, selecting and deleting rows as that role.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner_id text default (auth.uid())::text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket_id, name)
);

-- Same contract as Supabase: an object's folders, so `a/b/c.jpg` is `{a,b}`.
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Supabase grants every API role full access to new objects in `public` by default and relies
-- on row-level security; mirror that so the migration's revokes and policies are what limit
-- access here too.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
