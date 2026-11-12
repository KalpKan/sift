import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { toAuthUser } from "./auth-server";

describe("toAuthUser", () => {
  it("collects providers from app_metadata and identities", () => {
    const u = toAuthUser({
      id: "u1",
      email: "a@example.com",
      email_confirmed_at: "2026-11-12T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email", "google"] },
      identities: [{ provider: "google" }],
    } as never);
    expect(u).toEqual({ id: "u1", email: "a@example.com", emailConfirmed: true, providers: ["email", "google"] });
  });

  it("an unconfirmed email with no identities has no providers", () => {
    expect(toAuthUser({ id: "u2", email: "b@example.com", app_metadata: {} } as never)).toEqual({
      id: "u2",
      email: "b@example.com",
      emailConfirmed: false,
      providers: [],
    });
  });
});
