// @vitest-environment node
// The service-role client is server-only; running these in jsdom would define
// `window` and trip its own guard. The browser case sets `window` explicitly.
import { describe, expect, it } from "vitest";
import { readAdminEnv, getAdminSupabase, REFRESH_TOKEN_ENV, readRefreshToken, isAuthorizedRefresh } from "./supabase-admin";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://yzppfufqaekgaxcrsqxp.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  NEXT_PUBLIC_APP_SCHEMA: "sift",
};

describe("readAdminEnv", () => {
  it("reads the three names it needs", () => {
    expect(readAdminEnv(good)).toEqual({
      url: good.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: good.SUPABASE_SERVICE_ROLE_KEY,
      schema: "sift",
    });
  });

  it("returns null when any is missing, so the app still runs with no database", () => {
    for (const key of Object.keys(good)) {
      const env = { ...good, [key]: undefined };
      expect(readAdminEnv(env), key).toBeNull();
    }
    expect(readAdminEnv({})).toBeNull();
  });

  it("returns null for an empty string, not just an absent key", () => {
    expect(readAdminEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "" })).toBeNull();
  });

  it("throws on a malformed URL rather than failing mysteriously at query time", () => {
    expect(() => readAdminEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(/URL/);
  });

  it("throws on a schema name that is not a bare lowercase identifier", () => {
    // It goes into a PostgREST profile header; anything else is a bug or worse.
    expect(() => readAdminEnv({ ...good, NEXT_PUBLIC_APP_SCHEMA: "Sift; drop table" })).toThrow();
  });

  it("does NOT read the anon key — the admin client must never fall back to it", () => {
    const withAnon = { ...good, SUPABASE_SERVICE_ROLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
    expect(readAdminEnv(withAnon)).toBeNull();
  });
});

describe("getAdminSupabase", () => {
  it("returns null without the env, so /api/health still answers db:skipped", () => {
    expect(getAdminSupabase({})).toBeNull();
  });

  it("builds a client scoped to this app's schema", () => {
    const client = getAdminSupabase(good);
    expect(client).not.toBeNull();
    expect(typeof client!.from).toBe("function");
  });

  it("refuses to exist in a browser, because the service-role key bypasses RLS", () => {
    // The single most damaging mistake available in this codebase is importing
    // this module from a client component. Fail loudly rather than shipping
    // the key in a bundle.
    const original = globalThis.window;
    try {
      (globalThis as { window?: unknown }).window = {};
      expect(() => getAdminSupabase(good)).toThrow(/server/i);
    } finally {
      if (original === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = original;
    }
  });
});

describe("the refresh token", () => {
  it("is read from a server-only name", () => {
    expect(REFRESH_TOKEN_ENV).toBe("SIFT_REFRESH_TOKEN");
    expect(REFRESH_TOKEN_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
    expect(readRefreshToken({ SIFT_REFRESH_TOKEN: "s3cret" })).toBe("s3cret");
    expect(readRefreshToken({})).toBeNull();
    expect(readRefreshToken({ SIFT_REFRESH_TOKEN: "  " })).toBeNull();
  });

  it("authorises only an exact bearer match", () => {
    expect(isAuthorizedRefresh("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedRefresh("bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedRefresh("Bearer wrong", "s3cret")).toBe(false);
    expect(isAuthorizedRefresh("s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedRefresh(null, "s3cret")).toBe(false);
    expect(isAuthorizedRefresh("Bearer ", "s3cret")).toBe(false);
  });

  it("never authorises when the server has no token configured", () => {
    // The route returns 503 in this case; this is the belt to that braces.
    expect(isAuthorizedRefresh("Bearer anything", null)).toBe(false);
    expect(isAuthorizedRefresh(null, null)).toBe(false);
  });

  it("does not authorise a prefix or a longer string", () => {
    expect(isAuthorizedRefresh("Bearer s3cretX", "s3cret")).toBe(false);
    expect(isAuthorizedRefresh("Bearer s3cre", "s3cret")).toBe(false);
  });
});
