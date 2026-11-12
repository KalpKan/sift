import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FOLLOWS,
  OWNER_EMAILS_ENV,
  bearerToken,
  isAllowedOwner,
  parseOwnerEmails,
  resolveViewer,
  type AuthUser,
  type ViewerDeps,
} from "./access";

const kalp: AuthUser = { id: "u-kalp", email: "Kalpkansara123@gmail.com", emailConfirmed: true };
const stranger: AuthUser = { id: "u-x", email: "someone@example.com", emailConfirmed: true };

function deps(over: Partial<ViewerDeps> = {}): ViewerDeps {
  return {
    userFromBearer: vi.fn(async () => null),
    userFromCookies: vi.fn(async () => null),
    isOwner: vi.fn(async () => false),
    createOwner: vi.fn(async () => {}),
    ownerEmails: parseOwnerEmails("masterofmath01@gmail.com, kalpkansara123@gmail.com"),
    ...over,
  };
}

describe("owner allow-list", () => {
  it("reads SIFT_OWNER_EMAILS as a comma-separated, case-insensitive list", () => {
    expect(OWNER_EMAILS_ENV).toBe("SIFT_OWNER_EMAILS");
    expect([...parseOwnerEmails(" A@x.com,b@Y.com ,, ")]).toEqual(["a@x.com", "b@y.com"]);
    expect(parseOwnerEmails(undefined).size).toBe(0);
  });

  it("allows only a confirmed email on the list", () => {
    const allowed = parseOwnerEmails("kalpkansara123@gmail.com");
    expect(isAllowedOwner(kalp, allowed)).toBe(true);
    expect(isAllowedOwner({ ...kalp, emailConfirmed: false }, allowed)).toBe(false);
    expect(isAllowedOwner(stranger, allowed)).toBe(false);
    expect(isAllowedOwner({ ...kalp, email: null }, allowed)).toBe(false);
  });

  it("an empty list allows nobody (fails closed)", () => {
    expect(isAllowedOwner(kalp, parseOwnerEmails(""))).toBe(false);
  });

  it("follows Kalp's four fields by default", () => {
    expect(DEFAULT_FOLLOWS).toEqual(["brain-computer-interfaces", "neural-engineering", "deep-brain-stimulation", "stem-cells"]);
  });
});

describe("bearerToken", () => {
  it("extracts the token from an Authorization header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer   xyz ")).toBe("xyz");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
  });
});

describe("resolveViewer", () => {
  it("401s with no session and no bearer", async () => {
    expect(await resolveViewer(null, deps())).toEqual({ status: 401 });
  });

  it("401s on a bad bearer token and never falls back to cookies", async () => {
    const d = deps({ userFromCookies: vi.fn(async () => kalp), isOwner: vi.fn(async () => true) });
    expect(await resolveViewer("Bearer nope", d)).toEqual({ status: 401 });
    expect(d.userFromCookies).not.toHaveBeenCalled();
  });

  it("accepts an existing owner by bearer token (the iOS path)", async () => {
    const d = deps({ userFromBearer: vi.fn(async () => kalp), isOwner: vi.fn(async () => true) });
    expect(await resolveViewer("Bearer good", d)).toEqual({ status: 200, user: kalp });
    expect(d.userFromBearer).toHaveBeenCalledWith("good");
    expect(d.createOwner).not.toHaveBeenCalled();
  });

  it("accepts an existing owner by cookie session (the web path)", async () => {
    const d = deps({ userFromCookies: vi.fn(async () => kalp), isOwner: vi.fn(async () => true) });
    expect(await resolveViewer(null, d)).toEqual({ status: 200, user: kalp });
  });

  it("creates the owner row, with the default follows, on an allowed email's first sign-in", async () => {
    const d = deps({ userFromCookies: vi.fn(async () => kalp) });
    expect(await resolveViewer(null, d)).toEqual({ status: 200, user: kalp });
    expect(d.createOwner).toHaveBeenCalledWith("u-kalp", DEFAULT_FOLLOWS);
  });

  it("403s a signed-in stranger and never creates a row for them", async () => {
    const d = deps({ userFromCookies: vi.fn(async () => stranger) });
    expect(await resolveViewer(null, d)).toEqual({ status: 403, user: stranger });
    expect(d.createOwner).not.toHaveBeenCalled();
  });
});
