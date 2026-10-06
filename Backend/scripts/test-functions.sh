#!/usr/bin/env bash
# Typechecks and tests the Edge Functions with Deno (https://deno.com).
#
#   Backend/scripts/test-functions.sh
set -euo pipefail

functions="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase/functions" && pwd)"
cd "$functions"

# The repository root has a package.json; tell Deno not to treat this as a Node project.
deno check --no-lock --node-modules-dir=none moderate-content/index.ts
deno test --no-lock --node-modules-dir=none --quiet .
