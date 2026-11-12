import { describe, expect, it, vi } from "vitest";
import { PRIVATE_EVENT_ALLOWLIST, isPrivatePath, privacyBeforeSend, syncRecording } from "./posthog-privacy";

const ev = (event: string, properties: Record<string, unknown> = {}) => ({ uuid: "u", event, properties }) as never;

describe("isPrivatePath", () => {
  it("covers /me, /sign-in and /auth, and nothing public", () => {
    for (const p of ["/me", "/me/", "/me/settings", "/sign-in", "/auth/callback", "/auth/sign-out"]) expect(isPrivatePath(p), p).toBe(true);
    for (const p of ["/", "/t/stem-cells", "/media", "/mean", "/authors", "/sign-inx"]) expect(isPrivatePath(p), p).toBe(false);
  });
});

describe("privacyBeforeSend", () => {
  it("passes every event untouched on a public page", () => {
    const e = ev("$autocapture", { $el_text: "Neuromodulation", $current_url: "https://sift.kalpkan.com/" });
    expect(privacyBeforeSend(e, "/")).toBe(e);
  });

  it("drops autocapture, pageleave, pageview, rageclicks and replay snapshots on a private page", () => {
    for (const name of ["$autocapture", "$pageleave", "$pageview", "$rageclick", "$dead_click", "$snapshot", "$exception", "$web_vitals"]) {
      expect(privacyBeforeSend(ev(name, { $el_text: "Delete dbs (from Obsidian)" }), "/me/settings"), name).toBeNull();
    }
  });

  it("judges by the event's own URL too, so a pageleave sent after navigating away from /me is still dropped", () => {
    expect(privacyBeforeSend(ev("$pageleave", { $current_url: "https://sift.kalpkan.com/me/settings" }), "/")).toBeNull();
    expect(privacyBeforeSend(ev("$autocapture", { $pathname: "/sign-in" }), "/")).toBeNull();
  });

  it("lets the radar's two events through with only their own fields and standard context", () => {
    expect(PRIVATE_EVENT_ALLOWLIST).toEqual(["paper_opened", "paper_rated"]);
    const out = privacyBeforeSend(
      ev("paper_rated", { pmid: "41000001", verdict: 1, term: "dbs", title: "x", $el_text: "secret", $elements_chain: "a", $session_id: "s" }),
      "/me",
    ) as unknown as { properties: Record<string, unknown> };
    expect(out.properties).toEqual({ pmid: "41000001", verdict: 1, $session_id: "s" });
  });

  it("drops a null result through unchanged", () => {
    expect(privacyBeforeSend(null, "/me")).toBeNull();
  });
});

describe("syncRecording", () => {
  function ph(started: boolean) {
    return { sessionRecordingStarted: vi.fn(() => started), stopSessionRecording: vi.fn(), startSessionRecording: vi.fn() };
  }

  it("stops recording on entering a private page", () => {
    const p = ph(true);
    syncRecording(p, "/me");
    expect(p.stopSessionRecording).toHaveBeenCalledTimes(1);
  });

  it("starts it again on a public page, only if the guard was what stopped it", () => {
    const p = ph(false);
    syncRecording(p, "/me");
    syncRecording(p, "/t/stem-cells");
    expect(p.startSessionRecording).toHaveBeenCalledTimes(1);
    const q = ph(false);
    syncRecording(q, "/");
    expect(q.startSessionRecording).not.toHaveBeenCalled();
  });
});
