#!/usr/bin/env bash
# Guard for supabase/migrations/*.sql:
#   1. no migration may touch `public.` (one schema per app in the shared project);
#   2. once NEXT_PUBLIC_APP_SCHEMA is set, no `__APP__` placeholder may remain.
# Exit 0 = clean. Runs in CI and in the "Apply the migrations" README step.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
if grep -n '\bpublic\.' supabase/migrations/*.sql; then
  echo "error: migrations must not reference the public schema" >&2; status=1
fi
if [ -n "${NEXT_PUBLIC_APP_SCHEMA:-}" ] && grep -n '__APP__' supabase/migrations/*.sql; then
  echo "error: replace __APP__ with ${NEXT_PUBLIC_APP_SCHEMA} (sed -i '' 's/__APP__/${NEXT_PUBLIC_APP_SCHEMA}/g' supabase/migrations/*.sql)" >&2; status=1
fi
[ $status -eq 0 ] && echo "migrations ok"
exit $status
