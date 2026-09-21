import { z } from "zod";

/**
 * Environment names this app reads (all public, all baked in at build time).
 * Real values live in Vercel → Project → Settings → Environment Variables;
 * `.env.example` lists the names.
 */
export type Env = Record<string, string | undefined>;

export type SupabaseEnv = { url: string; anonKey: string; schema: string };

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // A Postgres schema name we can write unquoted in SQL and headers.
  NEXT_PUBLIC_APP_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, { error: "NEXT_PUBLIC_APP_SCHEMA must be a lowercase identifier (letters, digits, _)" }),
});

/**
 * The three names that connect this app to its schema in Supabase Project B.
 * Returns null when any is unset or empty (local dev without .env, the
 * template's own smoke test): the app then runs with the database off.
 * Throws when they are set but malformed, so a typo fails the build loudly.
 */
export function readSupabaseEnv(env: Env = process.env): SupabaseEnv | null {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_SCHEMA: env.NEXT_PUBLIC_APP_SCHEMA,
  };
  if (Object.values(raw).some((v) => !v)) return null;
  const result = supabaseEnvSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${String(issue.path[0])}: ${issue.message}`);
  }
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    schema: result.data.NEXT_PUBLIC_APP_SCHEMA,
  };
}

/**
 * The name reported by /api/health and shown in the footer:
 * NEXT_PUBLIC_APP_NAME, else the schema name, else "template".
 */
export function appName(env: Env = process.env): string {
  return env.NEXT_PUBLIC_APP_NAME || env.NEXT_PUBLIC_APP_SCHEMA || "template";
}
