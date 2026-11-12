/**
 * Who may use Sift's private radar (`/me`, `/api/me/*`).
 *
 * Sign-in is Google through the SHARED `auth.users` of Supabase Project B
 * (house rule 4): one account works across Kalp's apps, so being signed in
 * proves only who you are, not that you belong here. A `sift.profiles` row is
 * what makes someone a Sift user, and the only way one is created is here, on
 * the first authenticated request from a confirmed email listed in
 * SIFT_OWNER_EMAILS. The list lives in an env var, not in code, and an empty
 * or unset list lets nobody in.
 *
 *   no session, no bearer, or a bad token  -> 401
 *   signed in, but not an owner            -> 403
 *   owner                                  -> 200
 *
 * The web sends a cookie session (@supabase/ssr); the iPhone app sends
 * `Authorization: Bearer <supabase access token>`. A request that carries a
 * bearer header is judged on that token alone and never falls back to cookies.
 */

export const OWNER_EMAILS_ENV = "SIFT_OWNER_EMAILS";

/** Kalp's four fields (docs/spec.md, scope revision 2026-11-12). */
export const DEFAULT_FOLLOWS = [
  "brain-computer-interfaces",
  "neural-engineering",
  "deep-brain-stimulation",
  "stem-cells",
] as const;

export type AuthUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  /** Identity providers on the account (app_metadata + identities), e.g. ["google"]. */
  providers: string[];
  /** How THIS session authenticated: the JWT `amr` methods, e.g. ["oauth"]. */
  amr: string[];
};

/** Sift's owner signs in with Google; an allowed email via any other provider is not enough. */
export const OWNER_PROVIDER = "google";

export function parseOwnerEmails(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function readOwnerEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  return parseOwnerEmails(env[OWNER_EMAILS_ENV]);
}

export function isAllowedOwner(user: AuthUser, allowed: ReadonlySet<string>): boolean {
  if (!user.email || !user.emailConfirmed) return false;
  // Project B's auth.users is shared: another app could create an account
  // for the same address another way (a magic link, a password). Only a
  // Google identity, where Google vouched for the address, becomes the owner.
  if (!user.providers.includes(OWNER_PROVIDER)) return false;
  // And this very session must be an OAuth sign-in, not a magic link or a
  // password session on an account that merely has Google linked somewhere.
  if (!user.amr.includes("oauth")) return false;
  return allowed.has(user.email.trim().toLowerCase());
}

export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return m ? m[1] : null;
}

export type ViewerDeps = {
  userFromBearer(token: string): Promise<AuthUser | null>;
  userFromCookies(): Promise<AuthUser | null>;
  isOwner(userId: string): Promise<boolean>;
  createOwner(userId: string, followSlugs: readonly string[]): Promise<void>;
  ownerEmails: ReadonlySet<string>;
};

export type ViewerResult =
  | { status: 200; user: AuthUser }
  | { status: 401 }
  | { status: 403; user: AuthUser };

export async function resolveViewer(authorization: string | null, deps: ViewerDeps): Promise<ViewerResult> {
  let user: AuthUser | null;
  if (authorization && authorization.trim()) {
    const token = bearerToken(authorization);
    user = token ? await deps.userFromBearer(token) : null;
  } else {
    user = await deps.userFromCookies();
  }
  if (!user) return { status: 401 };

  if (await deps.isOwner(user.id)) return { status: 200, user };
  if (isAllowedOwner(user, deps.ownerEmails)) {
    await deps.createOwner(user.id, DEFAULT_FOLLOWS);
    return { status: 200, user };
  }
  return { status: 403, user };
}
