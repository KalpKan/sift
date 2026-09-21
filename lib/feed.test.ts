import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSummaries, type Paper, type SourceClient } from "./pubmed";
import { rankPapers } from "./ranking";
import {
  DEFAULT_LIMIT,
  FETCH_LIMIT,
  MAX_LIMIT,
  REFRESH_AFTER_MS,
  REFRESH_WINDOW_DAYS,
  authorsShort,
  clampLimit,
  getFeed,
  isStale,
  refreshTopic,
  toFeedPaper,
  type FeedStore,
  type StoredPaper,
  type Topic,
} from "./feed";

const corpus = parseSummaries(
  JSON.parse(
    readFileSync(path.resolve(__dirname, "..", "tests", "fixtures", "pubmed", "esummary-corpus.json"), "utf8"),
  ),
);

const NOW = new Date("2026-09-21T12:00:00Z");

const topic: Topic = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "neuromodulation",
  name: "Neuromodulation",
  pubmedQuery: '"deep brain stimulation"[MeSH Terms]',
  description: "Stimulating the nervous system on purpose.",
  kind: "clinical",
  source: "pubmed",
  isActive: true,
};

/** An in-memory FeedStore. The DB-backed one is lib/supabase-store.ts. */
function memoryStore(topics: Topic[] = [topic]) {
  const papers = new Map<string, Paper>();
  const scores = new Map<string, { pmid: string; score: number; reasons: string[]; rankedAt: string }>();
  const runs: Array<{ id: string; topicId: string; seen?: number; added?: number; error?: string | null }> = [];
  let firstSeen = new Map<string, string>();

  const store: FeedStore = {
    async getTopic(slug) {
      return topics.find((t) => t.slug === slug && t.isActive) ?? null;
    },
    async listTopics() {
      return topics.filter((t) => t.isActive);
    },
    async newestRankedAt(topicId) {
      const mine = [...scores.values()].filter((s) => s.pmid.startsWith("") && topicId);
      return mine.length ? mine.map((s) => s.rankedAt).sort().at(-1)! : null;
    },
    async upsertPapers(ps) {
      let added = 0;
      for (const p of ps) {
        if (!papers.has(p.pmid)) {
          added++;
          firstSeen.set(p.pmid, NOW.toISOString());
        }
        papers.set(p.pmid, p);
      }
      return added;
    },
    async upsertScores(topicId, rows) {
      for (const r of rows) scores.set(`${topicId}:${r.pmid}`, { ...r });
    },
    async readFeed(topicId, limit) {
      return [...scores.entries()]
        .filter(([k]) => k.startsWith(`${topicId}:`))
        .map(([, s]) => {
          const p = papers.get(s.pmid)!;
          return { ...p, score: s.score, reasons: s.reasons, rankedAt: s.rankedAt, firstSeenAt: firstSeen.get(s.pmid) ?? null };
        })
        .sort((a, b) => b.score - a.score || a.pmid.localeCompare(b.pmid))
        .slice(0, limit) as StoredPaper[];
    },
    async startRun(topicId) {
      const id = `run-${runs.length}`;
      runs.push({ id, topicId });
      return id;
    },
    async finishRun(id, result) {
      const run = runs.find((r) => r.id === id)!;
      Object.assign(run, result);
    },
  };
  return { store, papers, scores, runs, reset: () => (firstSeen = new Map()) };
}

function fakeSource(papers: Paper[] = corpus): SourceClient & { searches: number; summaries: number } {
  const s = {
    searches: 0,
    summaries: 0,
    async searchRecent() {
      s.searches++;
      return { pmids: papers.map((p) => p.pmid), total: papers.length };
    },
    async fetchSummaries(ids: string[]) {
      s.summaries++;
      return papers.filter((p) => ids.includes(p.pmid));
    },
  };
  return s;
}

describe("clampLimit", () => {
  it("defaults, floors and caps", () => {
    expect(clampLimit(null)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit("")).toBe(DEFAULT_LIMIT);
    expect(clampLimit("5")).toBe(5);
    expect(clampLimit("1")).toBe(1);
    expect(clampLimit("0")).toBe(1);
    expect(clampLimit("-9")).toBe(1);
    expect(clampLimit("banana")).toBe(DEFAULT_LIMIT);
    expect(clampLimit("7.9")).toBe(7);
  });

  it("caps hard, so nobody can pull the whole table through a query string", () => {
    expect(clampLimit("100000")).toBe(MAX_LIMIT);
    expect(clampLimit(String(MAX_LIMIT + 1))).toBe(MAX_LIMIT);
    expect(MAX_LIMIT).toBeLessThanOrEqual(100);
  });
});

describe("authorsShort", () => {
  it("matches the format the iOS client builds locally", () => {
    // ios/Shared/PaperFormatting.swift: "Kansara et al.", "Okafor & Lindqvist".
    expect(authorsShort(["Kansara K"])).toBe("Kansara");
    expect(authorsShort(["Okafor N", "Lindqvist S"])).toBe("Okafor & Lindqvist");
    expect(authorsShort(["Zhang C", "Yang L", "Zhang J"])).toBe("Zhang et al.");
  });

  it("keeps a multi-word surname intact", () => {
    expect(authorsShort(["van der Berg AB"])).toBe("van der Berg");
    expect(authorsShort(["de la Cruz M", "Smith J"])).toBe("de la Cruz & Smith");
  });

  it("leaves a collective author alone rather than mangling it", () => {
    expect(authorsShort(["Nautilus Study Group"])).toBe("Nautilus Study Group");
  });

  it("returns an empty string for no authors, never 'undefined et al.'", () => {
    expect(authorsShort([])).toBe("");
  });

  it("produces something usable for every author list in the corpus", () => {
    for (const p of corpus) {
      const s = authorsShort(p.authors);
      expect(s).not.toMatch(/undefined|null/);
      expect(s.length).toBeLessThan(60);
    }
  });
});

describe("isStale", () => {
  it("is stale when never ranked", () => {
    expect(isStale(null, NOW)).toBe(true);
  });

  it("is fresh inside the six-hour window and stale outside it", () => {
    expect(REFRESH_AFTER_MS).toBe(6 * 60 * 60 * 1000);
    const fiveHoursAgo = new Date(NOW.getTime() - 5 * 3600_000).toISOString();
    const sevenHoursAgo = new Date(NOW.getTime() - 7 * 3600_000).toISOString();
    expect(isStale(fiveHoursAgo, NOW)).toBe(false);
    expect(isStale(sevenHoursAgo, NOW)).toBe(true);
  });

  it("treats an unparseable timestamp as stale rather than trusting it forever", () => {
    expect(isStale("not a date", NOW)).toBe(true);
  });
});

describe("toFeedPaper", () => {
  const stored: StoredPaper = {
    ...corpus[0],
    score: 88,
    reasons: ["meta-analysis", "4 days old"],
    rankedAt: NOW.toISOString(),
    firstSeenAt: NOW.toISOString(),
  };

  it("emits exactly the field names ios/Shared/Paper.swift decodes", () => {
    const f = toFeedPaper(stored, "clinical");
    expect(Object.keys(f).sort()).toEqual(
      ["authorsShort", "doi", "id", "journal", "orderScore", "published", "pmid", "reasons", "score", "summary", "title", "url"].sort(),
    );
  });

  it("uses the PMID as the client-facing id", () => {
    expect(toFeedPaper(stored, "clinical").id).toBe(stored.pmid);
  });

  it("emits dates as full ISO 8601 with a timezone, which is what Swift's .iso8601 needs", () => {
    // A bare "2026-09-14" fails ISO8601DateFormatter's default options and the
    // whole feed would fail to decode on the phone.
    const f = toFeedPaper(stored, "clinical");
    expect(f.published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("sends quality in 0...1, not the server's ordering score", () => {
    const f = toFeedPaper(stored, "clinical");
    expect(f.score).toBeGreaterThanOrEqual(0);
    expect(f.score).toBeLessThanOrEqual(1);
    expect(f.score).not.toBe(stored.score);
  });

  it("also sends the ordering score, which is the one the web column shows", () => {
    // The web must show a number that actually descends down the page.
    expect(toFeedPaper(stored, "clinical").orderScore).toBe(stored.score);
  });

  it("never sends null for journal, which Swift declares non-optional", () => {
    const f = toFeedPaper({ ...stored, journal: null }, "clinical");
    expect(f.journal).toBe("");
    expect(typeof f.journal).toBe("string");
  });

  it("falls back to first_seen_at when a paper has no publication date", () => {
    const f = toFeedPaper({ ...stored, publishedOn: null }, "clinical");
    expect(f.published).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("carries the reasons through, so the web UI can show why it ranked", () => {
    expect(toFeedPaper(stored, "clinical").reasons).toEqual(["meta-analysis", "4 days old"]);
  });
});

describe("refreshTopic", () => {
  it("fetches, stores, ranks and records a run", async () => {
    const { store, runs, scores } = memoryStore();
    const source = fakeSource();
    const r = await refreshTopic({ store, source, topic, now: NOW });

    expect(source.searches).toBe(1);
    expect(source.summaries).toBe(1);
    expect(r.seen).toBe(corpus.length);
    expect(r.added).toBe(corpus.length);
    expect(scores.size).toBe(corpus.length);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ seen: corpus.length, added: corpus.length, error: null });
  });

  it("asks PubMed for a window wider than the refresh interval, so nothing is missed", () => {
    expect(REFRESH_WINDOW_DAYS).toBeGreaterThanOrEqual(7);
    // One esearch page and one esummary batch: two NCBI calls per refresh.
    expect(FETCH_LIMIT).toBeLessThanOrEqual(200);
  });

  it("counts a paper as 'added' only the first time it is seen", async () => {
    const { store } = memoryStore();
    const source = fakeSource();
    await refreshTopic({ store, source, topic, now: NOW });
    const second = await refreshTopic({ store, source, topic, now: NOW });
    expect(second.seen).toBe(corpus.length);
    expect(second.added).toBe(0);
  });

  it("stores the ranker's reasons alongside the score", async () => {
    const { store, scores } = memoryStore();
    await refreshTopic({ store, source: fakeSource(), topic, now: NOW });
    for (const s of scores.values()) {
      expect(Array.isArray(s.reasons)).toBe(true);
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });

  it("records the error on the run row and rethrows, so a failure is never silent", async () => {
    const { store, runs } = memoryStore();
    const source: SourceClient = {
      async searchRecent() {
        throw new Error("NCBI is down");
      },
      async fetchSummaries() {
        return [];
      },
    };
    await expect(refreshTopic({ store, source, topic, now: NOW })).rejects.toThrow("NCBI is down");
    expect(runs[0].error).toMatch(/NCBI is down/);
  });

  it("makes no esummary call when the search returns nothing", async () => {
    const { store } = memoryStore();
    const source = fakeSource([]);
    const r = await refreshTopic({ store, source, topic, now: NOW });
    expect(r.seen).toBe(0);
    expect(source.summaries).toBe(0);
  });

  it("uses the topic's kind, so an engineering topic is ranked as one", async () => {
    const eng: Topic = { ...topic, id: "2", slug: "bci", kind: "engineering" };
    const { store: s1, scores: c1 } = memoryStore([topic]);
    const { store: s2, scores: c2 } = memoryStore([eng]);
    await refreshTopic({ store: s1, source: fakeSource(), topic, now: NOW });
    await refreshTopic({ store: s2, source: fakeSource(), topic: eng, now: NOW });
    const pick = (m: Map<string, { score: number }>) => [...m.values()].map((v) => v.score);
    expect(pick(c1)).not.toEqual(pick(c2));
  });
});

describe("getFeed", () => {
  it("returns null for an unknown or inactive topic", async () => {
    const { store } = memoryStore();
    expect(await getFeed({ store, source: fakeSource(), slug: "nope", limit: 10, now: NOW })).toBeNull();
    const inactive = memoryStore([{ ...topic, isActive: false }]);
    expect(
      await getFeed({ store: inactive.store, source: fakeSource(), slug: topic.slug, limit: 10, now: NOW }),
    ).toBeNull();
  });

  it("refreshes on a cold cache, then serves the ranked papers", async () => {
    const { store } = memoryStore();
    const source = fakeSource();
    const feed = await getFeed({ store, source, slug: topic.slug, limit: 5, now: NOW });
    expect(source.searches).toBe(1);
    expect(feed!.papers).toHaveLength(5);
    // The wire order is the SERVER's ordering score (quality + recency), which
    // is deliberately not the `score` field on the wire (quality only, because
    // the phone adds its own recency). So assert the order matches the ranker,
    // not that the wire scores happen to descend — they need not.
    const expected = rankPapers(corpus, { now: NOW, kind: "clinical" })
      .slice(0, 5)
      .map((p) => p.pmid);
    expect(feed!.papers.map((p) => p.id)).toEqual(expected);
  });

  it("serves the cache without touching NCBI when the feed is fresh", async () => {
    const { store } = memoryStore();
    const source = fakeSource();
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: NOW });
    const later = new Date(NOW.getTime() + 60_000);
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: later });
    expect(source.searches).toBe(1);
  });

  it("refreshes again once six hours have passed", async () => {
    const { store } = memoryStore();
    const source = fakeSource();
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: NOW });
    const later = new Date(NOW.getTime() + REFRESH_AFTER_MS + 1000);
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: later });
    expect(source.searches).toBe(2);
  });

  it("serves a stale cache rather than an error when PubMed is down", async () => {
    // The widget showing last night's papers is a far better failure than the
    // widget showing nothing.
    const { store } = memoryStore();
    await getFeed({ store, source: fakeSource(), slug: topic.slug, limit: 5, now: NOW });
    const broken: SourceClient = {
      async searchRecent() {
        throw new Error("NCBI is down");
      },
      async fetchSummaries() {
        return [];
      },
    };
    const later = new Date(NOW.getTime() + REFRESH_AFTER_MS + 1000);
    const feed = await getFeed({ store, source: broken, slug: topic.slug, limit: 5, now: later });
    expect(feed!.papers.length).toBe(5);
  });

  it("propagates the failure when there is no cache at all to fall back to", async () => {
    const { store } = memoryStore();
    const broken: SourceClient = {
      async searchRecent() {
        throw new Error("NCBI is down");
      },
      async fetchSummaries() {
        return [];
      },
    };
    await expect(getFeed({ store, source: broken, slug: topic.slug, limit: 5, now: NOW })).rejects.toThrow(
      /NCBI is down/,
    );
  });

  it("returns the envelope both the web page and the Swift client need", async () => {
    const { store } = memoryStore();
    const feed = await getFeed({ store, source: fakeSource(), slug: topic.slug, limit: 3, now: NOW });
    // `topic` is this repo's documented contract; `id`/`name`/`query` are what
    // ios/Shared/Feed.swift decodes. Swift ignores the extra key.
    expect(feed).toMatchObject({
      topic: "neuromodulation",
      id: "neuromodulation",
      name: "Neuromodulation",
      query: topic.pubmedQuery,
    });
    expect(feed!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(feed!.papers).toHaveLength(3);
  });

  it("forces a refresh when asked, even on a warm cache", async () => {
    const { store } = memoryStore();
    const source = fakeSource();
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: NOW });
    await getFeed({ store, source, slug: topic.slug, limit: 5, now: NOW, force: true });
    expect(source.searches).toBe(2);
  });

  it("puts no case report or editorial in the top three of a real refreshed feed", async () => {
    const { store } = memoryStore();
    const feed = await getFeed({ store, source: fakeSource(), slug: topic.slug, limit: 3, now: NOW });
    const byPmid = new Map(corpus.map((p) => [p.pmid, p]));
    for (const p of feed!.papers) {
      const original = byPmid.get(p.id)!;
      for (const bad of ["Case Reports", "Editorial", "Comment", "Letter"]) {
        expect(original.pubTypes, p.title).not.toContain(bad);
      }
    }
  });
});
