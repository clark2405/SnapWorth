#!/usr/bin/env bash
# Runs the database tests against a throwaway local Postgres: a stand-in for Supabase's auth
# schema and roles, then every migration, the seed, and each *_test.sql file. Needs Postgres
# 15+ server binaries (initdb, pg_ctl, psql); no Docker or Supabase project required.
#
#   Backend/scripts/test-db.sh
#
# Postgres refuses to run as root, so under root the cluster runs as the `postgres` user.
set -euo pipefail

backend="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
supabase="$backend/supabase"
# The first directory that actually holds initdb: an explicit PG_BIN, pg_config's answer, then
# the newest Debian/Ubuntu server install.
bin=""
for candidate in "${PG_BIN:-}" "$(pg_config --bindir 2>/dev/null || true)" \
  $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV); do
  if [[ -n "$candidate" && -x "$candidate/initdb" ]]; then
    bin="$candidate"
    break
  fi
done
[[ -n "$bin" ]] || { echo "Postgres server binaries not found; set PG_BIN." >&2; exit 1; }

workdir="$(mktemp -d)"
port="${PG_TEST_PORT:-54329}"
as_db_user=()
if [[ "$(id -u)" == "0" ]]; then
  chown postgres "$workdir"
  as_db_user=(runuser -u postgres --)
fi

cleanup() {
  "${as_db_user[@]}" "$bin/pg_ctl" -D "$workdir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

"${as_db_user[@]}" "$bin/initdb" -D "$workdir/data" -U postgres --auth=trust >/dev/null
"${as_db_user[@]}" "$bin/pg_ctl" -D "$workdir/data" -l "$workdir/server.log" -w \
  -o "-p $port -k $workdir -c listen_addresses=''" start >/dev/null

run_sql() {
  "${as_db_user[@]}" "$bin/psql" -X -q -h "$workdir" -p "$port" -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -f "$1"
}

echo "Applying the Supabase stand-in…"
run_sql "$supabase/tests/support/supabase_stub.sql"
for migration in "$supabase"/migrations/*.sql; do
  echo "Applying $(basename "$migration")…"
  run_sql "$migration"
done
for seed in "$supabase"/seed/*.sql; do
  echo "Seeding $(basename "$seed")…"
  run_sql "$seed"
done
for test in "$supabase"/tests/*_test.sql; do
  echo "Running $(basename "$test")…"
  run_sql "$test"
done
