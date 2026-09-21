import { describe, it, expect, vi } from "vitest";

const capture = vi.fn();
vi.mock("@/lib/posthog", () => ({ capture }));

import { track } from "./track";

describe("track", () => {
  it("forwards the event to lib/posthog capture after the lazy import", async () => {
    track("project_card_clicked", { slug: "a", type: "app", kind: "live" });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture).toHaveBeenCalledWith("project_card_clicked", {
      slug: "a",
      type: "app",
      kind: "live",
    });
  });
});
