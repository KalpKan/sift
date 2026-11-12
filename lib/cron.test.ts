import { describe, expect, it, vi } from "vitest";
import { CRON_SECRET_ENV, isAuthorizedCron, refreshAllTopics, safeEqual } from "./cron";
import type { FeedStore, Topic } from "./feed";
import type { SourceClient } from "./pubmed";

describe("isAuthorizedCron", () => {
  it("accepts Vercel's `Bearer <CRON_SECRET>` and nothing else", () => {
    expect(CRON_SECRET_ENV).toBe("CRON_SECRET");
    const env = { CRON_SECRET: "s3cret" };
    expect(isAuthorizedCron("Bearer s3cret", env)).toBe(true);
    expect(isAuthorizedCron("Bearer wrong", env)).toBe(false);
    expect(isAuthorizedCron(null, env)).toBe(false);
  });

  it("fails closed when CRON_SECRET is unset, even for an empty bearer", () => {
    expect(isAuthorizedCron("Bearer ", {})).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", {})).toBe(false);
    expect(isAuthorizedCron("Bearer ", { CRON_SECRET: "" })).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares in constant time, including strings of different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("refreshAllTopics", () => {
  const topics: Topic[] = ["a", "b", "c"].map((slug, i) => ({
    id: `t${i}`, slug, name: slug, pubmedQuery: `q-${slug}`, description: null, kind: "clinical", source: "pubmed", isActive: true,
  }));

  function fakeStore(): FeedStore {
    let n = 0;
    return {
      getTopic: async () => null,
      listTopics: async () => topics,
      newestRankedAt: async () => null,
      upsertPapers: async (ps) => ps.length,
      upsertScores: async () => {},
      readFeed: async () => [],
      startRun: async () => `run${n++}`,
      finishRun: vi.fn(async () => {}),
    };
  }

  it("refreshes every active topic and keeps going after one fails", async () => {
    const source: SourceClient = {
      searchRecent: vi.fn(async (q: string) => {
        if (q === "q-b") throw new Error("NCBI 500");
        return { pmids: [], total: 0 };
      }),
      fetchSummaries: async () => [],
    };
    const out = await refreshAllTopics({ store: fakeStore(), source, now: new Date("2026-11-12T09:00:00Z") });
    expect(out).toEqual([
      { topic: "a", seen: 0, added: 0, error: null },
      { topic: "b", seen: 0, added: 0, error: "NCBI 500" },
      { topic: "c", seen: 0, added: 0, error: null },
    ]);
    expect(source.searchRecent).toHaveBeenCalledTimes(3);
  });
});

describe("vercel.json", () => {
  it("schedules /api/refresh once a day (the Hobby plan's limit)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const cfg = JSON.parse(readFileSync(path.resolve(__dirname, "..", "vercel.json"), "utf8"));
    expect(cfg.crons).toEqual([{ path: "/api/refresh", schedule: expect.stringMatching(/^\d{1,2} \d{1,2} \* \* \*$/) }]);
  });
});

describe("vercel.json ignoreCommand", () => {
  // Exit 0 = skip the build, exit 1 = build. Anything else is a FAILED deploy
  // (seen 2026-11-12: a shallow clone without the previous SHA made git exit 128).
  async function run(prev: string | undefined) {
    const { readFileSync } = await import("node:fs");
    const { spawnSync } = await import("node:child_process");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "..");
    const cmd = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")).ignoreCommand;
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (prev === undefined) delete env.VERCEL_GIT_PREVIOUS_SHA;
    else env.VERCEL_GIT_PREVIOUS_SHA = prev;
    return spawnSync("sh", ["-c", cmd], { cwd: root, env, encoding: "utf8" }).status;
  }

  it("builds (exit 1) when VERCEL_GIT_PREVIOUS_SHA is unset, never falling back to HEAD^", async () => {
    // HEAD^ would let a trailing docs-only commit hide code commits pushed with it.
    expect(await run(undefined)).toBe(1);
    expect(await run("")).toBe(1);
  });

  it("builds (exit 1), never errors, when the previous SHA is not in the clone", async () => {
    expect(await run("0123456789abcdef0123456789abcdef01234567")).toBe(1);
  });

  it("skips (exit 0) when nothing outside docs/scripts/ios/*.md changed since the previous SHA", async () => {
    expect(await run("HEAD")).toBe(0);
  });
});
