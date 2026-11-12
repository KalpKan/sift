import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { amrFromJwt, toAuthUser } from "./auth-server";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;

describe("amrFromJwt", () => {
  it("reads the authentication methods of a (verified) access token", () => {
    expect(amrFromJwt(jwt({ amr: [{ method: "oauth", timestamp: 1 }] }))).toEqual(["oauth"]);
    expect(amrFromJwt(jwt({ amr: [{ method: "password" }, { method: "otp" }] }))).toEqual(["password", "otp"]);
  });
  it("is empty for a token with no amr, or garbage", () => {
    expect(amrFromJwt(jwt({}))).toEqual([]);
    expect(amrFromJwt("not.a.jwt")).toEqual([]);
    expect(amrFromJwt(undefined)).toEqual([]);
  });
});

describe("toAuthUser", () => {
  it("collects providers from app_metadata and identities, and amr from the session token", () => {
    const u = toAuthUser(
      {
        id: "u1",
        email: "a@example.com",
        email_confirmed_at: "2026-11-12T00:00:00Z",
        app_metadata: { provider: "email", providers: ["email", "google"] },
        identities: [{ provider: "google" }],
      } as never,
      jwt({ amr: [{ method: "oauth" }] }),
    );
    expect(u).toEqual({ id: "u1", email: "a@example.com", emailConfirmed: true, providers: ["email", "google"], amr: ["oauth"] });
  });

  it("an unconfirmed email with no identities and no token has no providers and no amr", () => {
    expect(toAuthUser({ id: "u2", email: "b@example.com", app_metadata: {} } as never)).toEqual({
      id: "u2",
      email: "b@example.com",
      emailConfirmed: false,
      providers: [],
      amr: [],
    });
  });
});
