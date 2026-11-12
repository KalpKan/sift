/**
 * Server-side auth plumbing for the private radar. Never imported by a client
 * component and never by a public page (lib/public-pages.test.ts checks).
 *
 * Two ways in, both against Supabase Project B's shared auth.users:
 *   - the web: an @supabase/ssr cookie session, set by /auth/callback;
 *   - the iPhone app: `Authorization: Bearer <access token>`.
 * Both are verified with `auth.getUser()`, which asks the auth server, so a
 * signed-out or deleted user is refused now, not when their token expires.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { AuthUser } from "./access";
import { readSupabaseEnv } from "./env";

export function toAuthUser(u: User): AuthUser {
  return { id: u.id, email: u.email ?? null, emailConfirmed: Boolean(u.email_confirmed_at) };
}

/** Cookie-backed client for Server Components and Route Handlers. Null without a DB env. */
export async function createCookieSupabase() {
  const cfg = readSupabaseEnv();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // A Server Component cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export async function userFromCookies(): Promise<AuthUser | null> {
  const supabase = await createCookieSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : toAuthUser(data.user);
}

export async function userFromBearer(token: string): Promise<AuthUser | null> {
  const cfg = readSupabaseEnv();
  if (!cfg) return null;
  const supabase = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : toAuthUser(data.user);
}
