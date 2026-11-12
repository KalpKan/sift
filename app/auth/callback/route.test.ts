import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exchange: vi.fn(),
  createOwner: vi.fn(),
  isOwner: vi.fn(async () => false),
}));

vi.mock("@/lib/auth-server", () => ({
  createCookieSupabase: async () => ({ auth: { exchangeCodeForSession: h.exchange } }),
  toAuthUser: (u: { id: string; email: string }, token?: string) => ({
    id: u.id,
    email: u.email,
    emailConfirmed: true,
    providers: ["google"],
    amr: token === "oauth-token" ? ["oauth"] : [],
  }),
}));
vi.mock("@/lib/me-context", () => ({
  getMeContext: () => ({
    viewer: {
      userFromBearer: async () => null,
      userFromCookies: async () => null,
      isOwner: h.isOwner,
      createOwner: h.createOwner,
      ownerEmails: new Set(["owner.one@example.com"]),
    },
  }),
}));

import { GET } from "./route";

const call = (q: string) => GET(new Request(`https://sift.kalpkan.com/auth/callback${q}`));

describe("GET /auth/callback", () => {
  it("no code -> /sign-in?error=auth", async () => {
    const res = await call("");
    expect(res.headers.get("location")).toBe("https://sift.kalpkan.com/sign-in?error=auth");
  });

  it("a good code for an allowed email creates the owner and lands on /me", async () => {
    h.exchange.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "owner.one@example.com" }, session: { access_token: "oauth-token" } },
      error: null,
    });
    const res = await call("?code=abc");
    expect(h.createOwner).toHaveBeenCalledWith("u1", expect.any(Array));
    expect(res.headers.get("location")).toBe("https://sift.kalpkan.com/me");
  });

  it("if creating the owner fails, goes to /sign-in?error=auth instead of a 500", async () => {
    h.exchange.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "owner.one@example.com" }, session: { access_token: "oauth-token" } },
      error: null,
    });
    h.createOwner.mockRejectedValueOnce(new Error("createOwner/profile: boom"));
    const res = await call("?code=abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://sift.kalpkan.com/sign-in?error=auth");
  });
});
