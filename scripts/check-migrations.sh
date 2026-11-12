#!/usr/bin/env bash
# Guard for supabase/migrations/*.sql:
#   1. no migration may touch `public.` (one schema per app in the shared project);
#   2. once NEXT_PUBLIC_APP_SCHEMA is set, no `__APP__` placeholder may remain;
#   3. every table created is followed (in some migration) by `enable row level security`;
#   4. every `create policy` is granted `to authenticated` and keyed on `auth.uid()`:
#      a policy for anon or public would open personal rows to the public anon key.
# Exit 0 = clean. Runs in CI and in the "Apply the migrations" README step.
# MIGRATIONS_DIR overrides the folder (lib/migrations.test.ts uses it on fixtures).
set -euo pipefail
cd "$(dirname "$0")/.."
dir="${MIGRATIONS_DIR:-supabase/migrations}"
status=0
if grep -n '\bpublic\.' "$dir"/*.sql; then
  echo "error: migrations must not reference the public schema" >&2; status=1
fi
if [ -n "${NEXT_PUBLIC_APP_SCHEMA:-}" ] && grep -n '__APP__' "$dir"/*.sql; then
  echo "error: replace __APP__ with ${NEXT_PUBLIC_APP_SCHEMA} (sed -i '' 's/__APP__/${NEXT_PUBLIC_APP_SCHEMA}/g' $dir/*.sql)" >&2; status=1
fi

# All migrations as one lower-case text with `--` comments stripped, so prose
# can never satisfy (or trip) a check.
all="$(cat "$dir"/*.sql | tr '[:upper:]' '[:lower:]' | sed 's/--.*$//')"

for t in $(printf '%s\n' "$all" | grep -oE 'create table if not exists [a-z_]+\.[a-z_]+' | awk '{print $6}' | sort -u); do
  if ! printf '%s\n' "$all" | grep -qF "alter table $t enable row level security"; then
    echo "error: $t is created without row level security (add: alter table $t enable row level security;)" >&2; status=1
  fi
done

# One policy per line: join lines, then split on `;`.
while IFS= read -r stmt; do
  case "$stmt" in
    *"create policy"*)
      if ! printf '%s' "$stmt" | grep -qE ' to authenticated ' || ! printf '%s' "$stmt" | grep -qF 'auth.uid()'; then
        echo "error: policy must be 'to authenticated' and keyed on auth.uid(): $(printf '%s' "$stmt" | sed 's/^ *//' | cut -c1-120)" >&2; status=1
      fi ;;
  esac
done < <(printf '%s\n' "$all" | tr '\n' ' ' | tr -s ' ' | tr ';' '\n')

[ $status -eq 0 ] && echo "migrations ok"
exit $status
