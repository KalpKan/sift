/**
 * THE SERVER-ONLY SUPABASE CLIENT. Never import this from a client component.
 *
 * It authenticates with `SUPABASE_SERVICE_ROLE_KEY`, which BYPASSES ROW LEVEL
 * SECURITY entirely. Migration 0002 enables RLS on every `sift` table and
 * defines no policies at all, so this key is not one way to read those tables,
 * it is the only way. Leaking it into a browser bundle would hand a stranger
 * full read and write access to the whole schema.
 *
 * Three things protect against that:
 *   1. The env var has no `NEXT_PUBLIC_` prefix, so Next.js will not inline it
 *      into client code even if this module were imported there.
 *   2. `getAdminSupabase` throws if `window` exists.
 *   3. No component under `components/` imports this file. The anon client in
 *      lib/supabase.ts stays exactly as it was and is what /api/health uses.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "./database.types";
import type { Schema } from "./supabase";
import type { Env } from "./env";

export type AdminSupabaseClient = SupabaseClient<Database, Schema>;

export type AdminEnv = { url: string; serviceRoleKey: string; schema: string };

const adminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, { error: "NEXT_PUBLIC_APP_SCHEMA must be a lowercase identifier" }),
});

/**
 * Returns null when any name is unset, matching `readSupabaseEnv`: the site
 * must still build and serve without a database. Throws when a name is set but
 * malformed, so a typo fails loudly instead of silently querying nothing.
 */
export function readAdminEnv(env: Env = process.env): AdminEnv | null {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_SCHEMA: env.NEXT_PUBLIC_APP_SCHEMA,
  };
  if (Object.values(raw).some((v) => !v)) return null;
  const parsed = adminEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${String(issue.path[0])}: ${issue.message}`);
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    schema: parsed.data.NEXT_PUBLIC_APP_SCHEMA,
  };
}

let cached: AdminSupabaseClient | null | undefined;

export function getAdminSupabase(env: Env = process.env): AdminSupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("getAdminSupabase() is server-only: the service-role key must never reach a browser.");
  }
  if (env === process.env && cached !== undefined) return cached;
  const cfg = readAdminEnv(env);
  const client = cfg
    ? (createClient<Database, Schema>(cfg.url, cfg.serviceRoleKey, {
        db: { schema: cfg.schema as Schema },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as AdminSupabaseClient)
    : null;
  if (env === process.env) cached = client;
  return client;
}

// ---------------------------------------------------------------------------
// The refresh token
// ---------------------------------------------------------------------------

/** Server-only by construction: no NEXT_PUBLIC_ prefix, so it is never bundled. */
export const REFRESH_TOKEN_ENV = "SIFT_REFRESH_TOKEN";

export function readRefreshToken(env: Env = process.env): string | null {
  const v = env[REFRESH_TOKEN_ENV];
  return v && v.trim() ? v : null;
}

/**
 * `POST /api/refresh` forces PubMed traffic, so it is not open. When no token
 * is configured the route answers 503 rather than running unauthenticated —
 * an unset secret must fail closed, never open.
 */
export function isAuthorizedRefresh(header: string | null, token: string | null): boolean {
  if (!token) return false;
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return match[1].trim() === token;
}
