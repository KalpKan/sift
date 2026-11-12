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

/**
 * The JWT `amr` methods ("oauth", "password", "otp", ...) of an access token.
 * Only ever called on a token that `auth.getUser(token)` has just verified, so
 * decoding the payload without checking the signature again is safe.
 */
export function amrFromJwt(token: string | undefined | null): string[] {
  if (!token) return [];
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return [];
    return payload.amr
      .map((a) => (typeof a === "string" ? a : a && typeof a === "object" ? (a as { method?: unknown }).method : null))
      .filter((m): m is string => typeof m === "string");
  } catch {
    return [];
  }
}

export function toAuthUser(u: User, accessToken?: string | null): AuthUser {
  const meta = (u.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const providers = new Set<string>();
  if (typeof meta.provider === "string") providers.add(meta.provider);
  if (Array.isArray(meta.providers)) for (const p of meta.providers) if (typeof p === "string") providers.add(p);
  for (const i of u.identities ?? []) if (i.provider) providers.add(i.provider);
  return {
    id: u.id,
    email: u.email ?? null,
    emailConfirmed: Boolean(u.email_confirmed_at),
    providers: [...providers],
    amr: amrFromJwt(accessToken),
  };
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
  // The session's access token (refreshed if it had expired), then verified
  // by the auth server; its `amr` says how this session signed in.
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : toAuthUser(data.user, token);
}

export async function userFromBearer(token: string): Promise<AuthUser | null> {
  const cfg = readSupabaseEnv();
  if (!cfg) return null;
  const supabase = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : toAuthUser(data.user, token);
}
