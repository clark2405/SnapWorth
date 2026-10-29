#!/usr/bin/env bash
# Two phones chatting, and a third trying to get in, against a throwaway local backend: starts
# start.sh, runs two-devices.ts with the app's real chat code, then tears everything down.
# Needs Postgres 15+ server binaries and the Frontend's npm dependencies installed.
#
#   Backend/scripts/chat-sim/run.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend="$here/../../../Frontend"
log="$(mktemp)"

"$here/start.sh" >"$log" 2>&1 &
stack=$!
trap 'kill "$stack" 2>/dev/null; wait "$stack" 2>/dev/null; rm -f "$log"' EXIT

for _ in $(seq 1 60); do
  grep -q '"anonKey"' "$log" && break
  kill -0 "$stack" 2>/dev/null || { cat "$log" >&2; exit 1; }
  sleep 0.5
done
ready="$(grep '"anonKey"' "$log" | tail -1)"
field() { node -e "process.stdout.write(String(JSON.parse(process.argv[1])[process.argv[2]]))" "$ready" "$1"; }

export SUPABASE_URL="$(field url)" SUPABASE_ANON_KEY="$(field anonKey)"
export PG_HOST="$(field pgHost)" PG_PORT="$(field pgPort)"
export PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV | head -1)}"
cd "$frontend"
node -r sucrase/register/ts "$here/two-devices.ts"
