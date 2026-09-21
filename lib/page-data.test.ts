// @vitest-environment node
import { describe, expect, it } from "vitest";
import { freshness, loadFeed, loadTopics } from "./page-data";

const NOW = new Date("2026-09-21T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("freshness", () => {
  it("reads as plain English at every scale", () => {
    expect(freshness(ago(0), NOW)).toBe("just now");
    expect(freshness(ago(30_000), NOW)).toBe("just now");
    expect(freshness(ago(60_000), NOW)).toBe("1 minute ago");
    expect(freshness(ago(20 * 60_000), NOW)).toBe("20 minutes ago");
    expect(freshness(ago(3_600_000), NOW)).toBe("1 hour ago");
    expect(freshness(ago(6 * 3_600_000), NOW)).toBe("6 hours ago");
    expect(freshness(ago(26 * 3_600_000), NOW)).toBe("1 day ago");
    expect(freshness(ago(72 * 3_600_000), NOW)).toBe("3 days ago");
  });

  it("rounds down, so the page never claims to be fresher than it is", () => {
    expect(freshness(ago(119 * 60_000), NOW)).toBe("1 hour ago");
  });

  it("never prints a negative age when the clocks disagree", () => {
    expect(freshness(ago(-60_000), NOW)).toBe("just now");
  });

  it("says so plainly when the timestamp is unusable", () => {
    expect(freshness("nonsense", NOW)).toBe("at an unknown time");
  });
});

describe("loading with no database configured", () => {
  // `getStore()` reads process.env, which is empty of Supabase names here.
  // This is the state of a fresh clone and of the template's own smoke deploy,
  // and both pages must still render.
  it("returns an explanatory error rather than throwing", async () => {
    const topics = await loadTopics();
    expect(topics.data).toBeNull();
    expect(topics.error).toMatch(/not configured/i);

    const feed = await loadFeed("neuromodulation", 10);
    expect(feed.data).toBeNull();
    expect(feed.error).toMatch(/not configured/i);
  });
});
