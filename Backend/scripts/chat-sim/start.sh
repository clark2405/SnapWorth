#!/usr/bin/env bash
# Starts a throwaway local backend for chat: Postgres with every migration and seed (the same
# stand-in for Supabase's auth schema as test-db.sh), and gateway.cjs in front of it. Runs until
# stopped, then deletes everything. Prints the gateway's URL and anon key when ready.
#
#   Backend/scripts/chat-sim/start.sh
#
# Point the apps at it with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase="$here/../../supabase"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV | head -1)}"
port="${PG_PORT:-54329}"
workdir="$(mktemp -d)"
as_db_user=()
if [[ "$(id -u)" == "0" ]]; then
  chown postgres "$workdir"
  as_db_user=(runuser -u postgres --)
fi

cleanup() {
  [[ -n "${gateway_pid:-}" ]] && kill "$gateway_pid" 2>/dev/null || true
  "${as_db_user[@]}" "$bin/pg_ctl" -D "$workdir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT INT TERM

"${as_db_user[@]}" "$bin/initdb" -D "$workdir/data" -U postgres --auth=trust >/dev/null
"${as_db_user[@]}" "$bin/pg_ctl" -D "$workdir/data" -l "$workdir/server.log" -w \
  -o "-p $port -k $workdir -c listen_addresses='' -c wal_level=logical" start >/dev/null

run_sql() {
  "$bin/psql" -X -q -h "$workdir" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

run_sql -f "$supabase/tests/support/supabase_stub.sql"
# Supabase creates this publication; the chat migration adds `messages` to it.
run_sql -c 'create publication supabase_realtime;'
for migration in "$supabase"/migrations/*.sql; do run_sql -f "$migration"; done
for seed in "$supabase"/seed/*.sql; do run_sql -f "$seed"; done

# The Realtime stand-in's change feed: only rows in the publication, recorded by id. This lives
# in a scratch schema of this throwaway database, never in a migration.
run_sql <<'SQL'
create schema sim;
create table sim.changes (
  seq bigserial primary key,
  table_name text not null,
  op text not null,
  row_id uuid not null,
  at timestamptz not null default clock_timestamp()
);
-- Runs as its owner: like reading the WAL, it must not depend on what the writer may access.
create function sim.record_change() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into sim.changes (table_name, op, row_id) values (tg_table_name, tg_op, new.id);
  return new;
end;
$$;
do $$
declare t record;
begin
  for t in select tablename from pg_publication_tables where pubname = 'supabase_realtime' loop
    execute format(
      'create trigger sim_record_change after insert or update on public.%I
         for each row execute function sim.record_change()', t.tablename);
  end loop;
end;
$$;
SQL

export PG_HOST="$workdir" PG_PORT="$port" PG_BIN="$bin"
export JWT_SECRET="${JWT_SECRET:-$(head -c 32 /dev/urandom | base64)}"
node "$here/gateway.cjs" &
gateway_pid=$!
wait "$gateway_pid"
