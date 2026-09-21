import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { readSupabaseEnv, type Env } from "./env";

/**
 * The schema this app owns inside Supabase Project B ("platform"). It is the
 * value of NEXT_PUBLIC_APP_SCHEMA; the generated `Database` type will narrow
 * this to the literal name (`"hoops"`), so change it to that literal when you
 * replace `database.types.ts`.
 */
export type Schema = "adspace";

export type AppSupabaseClient = SupabaseClient<Database, Schema>;

let cached: AppSupabaseClient | null | undefined;

/**
 * A supabase-js client scoped to this app's schema. Every request carries
 * `Accept-Profile: <schema>` / `Content-Profile: <schema>`, so this app can
 * never read or write another app's tables in the shared project.
 *
 * Returns null when the env triple is unset (README, "Where the settings
 * live"), which is how the template's own smoke deploy runs.
 */
export function getSupabase(env: Env = process.env): AppSupabaseClient | null {
  if (env === process.env && cached !== undefined) return cached;
  const cfg = readSupabaseEnv(env);
  // `cfg.schema` is validated at runtime as a lowercase identifier but typed as
  // `string`; the generated `Database` only describes this app's own schema, so
  // the cast tells TypeScript what the env var is required to contain. A wrong
  // value fails loudly at the first query rather than silently reading elsewhere.
  const client = cfg
    ? (createClient<Database, Schema>(cfg.url, cfg.anonKey, {
        db: { schema: cfg.schema as Schema },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as AppSupabaseClient)
    : null;
  if (env === process.env) cached = client;
  return client;
}
