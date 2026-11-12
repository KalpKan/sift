import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

const h = vi.hoisted(() => ({ path: "/", loaded: 0, init: vi.fn(), sync: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
vi.mock("@/lib/posthog", () => {
  h.loaded += 1;
  return { initPostHog: h.init, syncPrivacy: h.sync };
});

import PostHogProvider from "./PostHogProvider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PostHogProvider", () => {
  it("does not load posthog-js during hydration; it waits for load, then follows navigation", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const el = document.createElement("div");
    const root = createRoot(el);

    await act(async () => root.render(<PostHogProvider>x</PostHogProvider>));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(h.loaded).toBe(0);
    expect(h.sync).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("load"));
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(h.loaded).toBe(1);
    expect(h.init).toHaveBeenCalledTimes(1);

    // A client-side navigation into the private radar after boot stops replay.
    h.path = "/me";
    await act(async () => root.render(<PostHogProvider>y</PostHogProvider>));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(h.sync).toHaveBeenCalledWith("/me");
    act(() => root.unmount());
  });
});
