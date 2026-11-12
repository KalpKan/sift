import { describe, it, expect, vi } from "vitest";

const seen = vi.hoisted(() => ({ opts: null as null | Record<string, unknown> }));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn((_key: string, opts: Record<string, unknown>) => {
      seen.opts = opts;
    }),
    capture: vi.fn(),
    __loaded: false,
    sessionRecordingStarted: vi.fn(() => true),
    stopSessionRecording: vi.fn(),
    startSessionRecording: vi.fn(),
  },
}));

import posthog from "posthog-js";
import {
  POSTHOG_INIT_OPTIONS,
  posthogRewrites,
  capture,
  initPostHog,
  syncPrivacy,
} from "./posthog";

describe("POSTHOG_INIT_OPTIONS (the analytics contract)", () => {
  it("is cookieless and proxied through /ingest", () => {
    expect(POSTHOG_INIT_OPTIONS.persistence).toBe("memory");
    expect(POSTHOG_INIT_OPTIONS.api_host).toBe("/ingest");
    expect(POSTHOG_INIT_OPTIONS.ui_host).toBe("https://us.posthog.com");
  });

  it("autocaptures, captures pageviews, and masks every input in replays", () => {
    expect(POSTHOG_INIT_OPTIONS.autocapture).toBe(true);
    expect(POSTHOG_INIT_OPTIONS.capture_pageview).toBe(true);
    expect(POSTHOG_INIT_OPTIONS.session_recording?.maskAllInputs).toBe(true);
  });
});

describe("posthogRewrites", () => {
  it("maps /ingest to the PostHog US hosts, static assets first", () => {
    const r = posthogRewrites();
    expect(r[0]).toEqual({
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    });
    expect(r[1]).toEqual({
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    });
  });
});

describe("capture / initPostHog without a key", () => {
  it("initPostHog is a silent no-op when NEXT_PUBLIC_POSTHOG_KEY is unset", () => {
    initPostHog("");
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("capture does not throw and does not send when not loaded", () => {
    expect(() => capture("project_card_clicked", { slug: "x", type: "app" })).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("initPostHog initialises once with the contract options when a key is given", () => {
    initPostHog("phc_test");
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ persistence: "memory", api_host: "/ingest" }),
    );
    initPostHog("phc_test");
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("capture sends instantly over sendBeacon so a click that navigates away is not lost", () => {
    capture("project_card_clicked", { slug: "plato", type: "app" });
    expect(posthog.capture).toHaveBeenCalledWith(
      "project_card_clicked",
      { slug: "plato", type: "app" },
      { send_instantly: true, transport: "sendBeacon" },
    );
  });
});

describe("the private-radar guard is wired into init", () => {
  type InitOpts = { before_send: (r: unknown) => unknown; disable_session_recording: boolean };
  const opts = () => seen.opts as unknown as InitOpts;

  it("passes before_send, which drops autocapture whenever the page is private", () => {
    const send = opts().before_send;
    const auto = { event: "$autocapture", properties: { $el_text: "Delete bci (from Obsidian)" } };
    window.history.pushState({}, "", "/me/settings");
    expect(send(auto)).toBeNull();
    window.history.pushState({}, "", "/");
    expect(send(auto)).toBe(auto);
  });

  it("syncPrivacy stops the recorder on a private path", () => {
    syncPrivacy("/me");
    expect(posthog.stopSessionRecording).toHaveBeenCalled();
  });
});

