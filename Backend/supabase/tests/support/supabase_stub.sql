-- Local-only stand-in for the parts of a Supabase database the migrations rely on: the `auth`
-- schema, `auth.uid()`, and the anon/authenticated/service_role roles with Supabase's default
-- privileges. Used by Backend/scripts/test-db.sh; never applied to a real project.

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

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants every API role full access to new objects in `public` by default and relies
-- on row-level security; mirror that so the migration's revokes and policies are what limit
-- access here too.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
