-- 0001_create_schema.sql
--
-- Creates this app's own schema inside the shared Supabase project ("Project B",
-- ref yzppfufqaekgaxcrsqxp). One schema per app, never `public`.
--
-- BEFORE APPLYING: replace every `adspace` below with your schema name (the same
-- value you put in NEXT_PUBLIC_APP_SCHEMA). From the repo root:
--     sed -i '' 's/adspace/myapp/g' supabase/migrations/*.sql
-- and check nothing is left:  grep -rn adspace supabase/  (must print nothing).
--
-- AFTER APPLYING, ONE MANUAL STEP: PostgREST only serves schemas listed in the
-- project's "Exposed schemas". Add your schema there or every request returns
--   {"code":"PGRST106","message":"The schema must be one of the following: ..."}
-- Dashboard: Supabase → project "platform" → Project Settings → Data API →
-- Exposed schemas → add `adspace` (keep the existing entries). The API version
-- of this step is in the portfolio-ops runbook "Add a schema to Supabase
-- Project B", step 3.
--
-- How to apply: the runbook's step 2 (Management API SQL endpoint), one file at
-- a time, in order.

create schema if not exists adspace;

-- The API roles must be able to see the schema at all ...
grant usage on schema adspace to anon, authenticated, service_role;

-- ... and every table, sequence and function created later inherits grants,
-- so later migrations never need their own GRANT lines. Row Level Security
-- still applies: enable it on every table you create.
alter default privileges in schema adspace grant all on tables to anon, authenticated, service_role;
alter default privileges in schema adspace grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema adspace grant all on functions to anon, authenticated, service_role;

-- `select 1` for /api/health. supabase-js cannot run raw SQL, so the health
-- route calls this function through PostgREST (`rpc("health_select_one")`).
create or replace function adspace.health_select_one()
returns integer
language sql
stable
as $$ select 1 $$;

grant execute on function adspace.health_select_one() to anon, authenticated, service_role;

-- Objects created in this same file are covered explicitly (default privileges
-- only apply to objects created afterwards).
grant all on all tables in schema adspace to anon, authenticated, service_role;
grant all on all sequences in schema adspace to anon, authenticated, service_role;
