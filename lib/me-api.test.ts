import { describe, expect, it } from "vitest";
import type { AuthUser, ViewerDeps } from "./access";
import type { StoredPaper, Topic } from "./feed";
import type { Interest, InterestRow, InterestSource } from "./personal";
import { POINTS_PER_WEIGHT, TAP_STEP } from "./personal";
import {
  handleFeed,
  handleFollows,
  handleInterests,
  handleOpen,
  handleRate,
  type MeContext,
  type RadarStore,
  type RatingRow,
} from "./me-api";

const NOW = new Date("2026-11-12T12:00:00Z");
const kalp: AuthUser = { id: "u-kalp", email: "kalpkansara123@gmail.com", emailConfirmed: true };
const stranger: AuthUser = { id: "u-x", email: "x@example.com", emailConfirmed: true };

function topic(slug: string, i: number): Topic {
  return { id: `t${i}`, slug, name: slug.replace(/-/g, " "), pubmedQuery: `q-${slug}`, description: null, kind: "clinical", source: "pubmed", isActive: true };
}
const TOPICS = ["brain-computer-interfaces", "neural-engineering", "deep-brain-stimulation", "stem-cells", "neuromodulation"].map(topic);

function paper(pmid: string, over: Partial<StoredPaper> = {}): StoredPaper {
  return {
    pmid, title: `Paper ${pmid}`, journal: "Brain", authors: ["Doe J", "Roe K"], doi: null,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, publishedOn: "2026-11-01", datePrecision: "day",
    pubTypes: [], raw: null, score: 60, reasons: [], rankedAt: "2026-11-12T06:00:00.123Z", firstSeenAt: "2026-11-02T00:00:00Z", ...over,
  };
}

/** In-memory RadarStore; the real one is lib/radar-store.ts. */
function memoryRadar(seed: { owners?: string[]; byTopic?: Record<string, StoredPaper[]> } = {}) {
  const owners = new Set(seed.owners ?? []);
  const follows = new Map<string, Set<string>>();
  const interests: Array<InterestRow & { userId: string }> = [];
  const ratings = new Map<string, RatingRow>();
  const opens: Array<{ userId: string; pmid: string; surface: string }> = [];
  const byTopic = seed.byTopic ?? {};
  const allPapers = new Map(Object.values(byTopic).flat().map((p) => [p.pmid, p]));
  const store: RadarStore = {
    async isOwner(id) { return owners.has(id); },
    async createOwner(id, slugs) {
      owners.add(id);
      follows.set(id, new Set(TOPICS.filter((t) => slugs.includes(t.slug)).map((t) => t.id)));
    },
    async listTopics() { return TOPICS; },
    async listFollows(id) { return [...(follows.get(id) ?? [])]; },
    async setFollows(id, ids) { follows.set(id, new Set(ids)); },
    async readCandidates(topics) {
      return topics.flatMap((t) => (byTopic[t.slug] ?? []).map((p) => ({ paper: p, topic: t.slug, kind: t.kind })));
    },
    async listInterests(id) { return interests.filter((i) => i.userId === id).map(({ term, weight, source }) => ({ term, weight, source })); },
    async deleteInterest(id, term, source) {
      const i = interests.findIndex((r) => r.userId === id && r.term === term && r.source === source);
      if (i < 0) return 0;
      interests.splice(i, 1);
      return 1;
    },
    async upsertInterests(id, source: InterestSource, rows: Interest[]) {
      for (const r of rows) {
        const hit = interests.find((x) => x.userId === id && x.term === r.term && x.source === source);
        if (hit) hit.weight = r.weight;
        else interests.push({ userId: id, term: r.term, weight: r.weight, source });
      }
    },
    async getPaper(pmid) { const p = allPapers.get(pmid); return p ? { pmid, title: p.title, journal: p.journal } : null; },
    async getRatings(id) {
      return new Map([...ratings.values()].filter((r) => r.userId === id).map((r) => [r.pmid, r.verdict]));
    },
    async upsertRating(row) { ratings.set(`${row.userId}:${row.pmid}`, row); },
    async insertOpen(row) { opens.push(row); },
  };
  return { store, owners, follows, interests, ratings, opens };
}

function ctx(radar: RadarStore, user: AuthUser | null, over: Partial<ViewerDeps> = {}): MeContext {
  return {
    radar,
    now: NOW,
    viewer: {
      userFromBearer: async (t) => (t === "good" ? user : null),
      userFromCookies: async () => user,
      isOwner: (id) => radar.isOwner(id),
      createOwner: (id, s) => radar.createOwner(id, s),
      ownerEmails: new Set(["kalpkansara123@gmail.com"]),
      ...over,
    },
  };
}

const get = (url: string, headers: Record<string, string> = {}) => new Request(`https://sift.kalpkan.com${url}`, { headers });
const send = (method: string, url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://sift.kalpkan.com${url}`, {
    method,
    headers: { "content-type": "application/json", origin: "https://sift.kalpkan.com", ...headers },
    body: JSON.stringify(body),
  });

describe("every /api/me route", () => {
  const routes: Array<[string, (r: Request, c: MeContext) => Promise<Response>, () => Request]> = [
    ["feed", handleFeed, () => get("/api/me/feed")],
    ["rate", handleRate, () => send("POST", "/api/me/rate", { pmid: "1", verdict: 1, surface: "web", shownRank: 1, recencyRank: 1, rankerVersion: "p1" })],
    ["open", handleOpen, () => send("POST", "/api/me/open", { pmid: "1", surface: "web" })],
    ["interests", handleInterests, () => get("/api/me/interests")],
    ["follows", handleFollows, () => get("/api/me/follows")],
  ];

  for (const [name, handler, req] of routes) {
    it(`${name}: 401 signed out, with a Bearer challenge and no data`, async () => {
      const res = await handler(req(), ctx(memoryRadar().store, null));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe("Bearer");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(Object.keys(await res.json())).toEqual(["error"]);
    });

    it(`${name}: 403 for a signed-in non-owner`, async () => {
      const res = await handler(req(), ctx(memoryRadar().store, stranger));
      expect(res.status).toBe(403);
      expect(Object.keys(await res.json())).toEqual(["error"]);
    });
  }

  it("401s a bad bearer token even when a cookie session would pass", async () => {
    const { store } = memoryRadar({ owners: ["u-kalp"] });
    const res = await handleFeed(get("/api/me/feed", { authorization: "Bearer bad" }), ctx(store, kalp));
    expect(res.status).toBe(401);
  });

  it("refuses a cookie-authenticated POST from another origin", async () => {
    const { store } = memoryRadar({ owners: ["u-kalp"], byTopic: { "stem-cells": [paper("1")] } });
    const res = await handleOpen(send("POST", "/api/me/open", { pmid: "1", surface: "web" }, { origin: "https://evil.example" }), ctx(store, kalp));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/me/feed", () => {
  const byTopic = {
    "brain-computer-interfaces": [paper("101", { score: 70, title: "Speech BCI in people with ALS" }), paper("102", { score: 50 })],
    "deep-brain-stimulation": [paper("101", { score: 65 }), paper("201", { score: 66, title: "Neurotrophins and DBS", publishedOn: "2026-11-12" })],
    neuromodulation: [paper("999", { score: 99 })],
  };

  it("creates the owner on first sign-in and serves the merged feed of the four default follows", async () => {
    const r = memoryRadar({ byTopic });
    const res = await handleFeed(get("/api/me/feed"), ctx(r.store, kalp));
    expect(res.status).toBe(200);
    expect(r.owners.has("u-kalp")).toBe(true);
    const body = await res.json();
    // neuromodulation is not followed, so 999 never appears; 101 is deduped.
    expect(body.papers.map((p: { id: string }) => p.id)).toEqual(["101", "201", "102"]);
  });

  it("works with a bearer token (iOS)", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic });
    await r.store.createOwner("u-kalp", ["deep-brain-stimulation"]);
    const res = await handleFeed(get("/api/me/feed?limit=1", { authorization: "Bearer good" }), ctx(r.store, kalp));
    expect(res.status).toBe(200);
    expect((await res.json()).papers).toHaveLength(1);
  });

  it("answers in the shape ios/Shared/Feed.swift decodes, plus the eval fields", async () => {
    const r = memoryRadar({ byTopic });
    await r.store.createOwner("u-kalp", ["deep-brain-stimulation", "brain-computer-interfaces"]);
    await r.store.upsertInterests("u-kalp", "obsidian", [{ term: "neurotrophins", weight: 0.5 }]);
    const body = await (await handleFeed(get("/api/me/feed"), ctx(r.store, kalp))).json();

    // Feed: id, name, query, papers, updatedAt (ISO 8601 with zone).
    expect(typeof body.id).toBe("string");
    expect(typeof body.name).toBe("string");
    expect(typeof body.query).toBe("string");
    expect(body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(body.rankerVersion).toBe("p1");

    const first = body.papers[0];
    expect(first.id).toBe("201");
    // Paper: id, title, journal (non-null String), authorsShort, published, doi?, url?, score (Double), summary?
    for (const p of body.papers) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(typeof p.journal).toBe("string");
      expect(typeof p.authorsShort).toBe("string");
      expect(p.published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
      expect(p.doi === null || typeof p.doi === "string").toBe(true);
      expect(p.url === null || typeof p.url === "string").toBe(true);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(1);
      expect(p.summary).toBeNull();
      expect(Number.isInteger(p.shownRank)).toBe(true);
      expect(Number.isInteger(p.recencyRank)).toBe(true);
      expect(p.rankerVersion).toBe("p1");
      expect(typeof p.topic).toBe("string");
    }
    expect(first.shownRank).toBe(1);
    expect(first.orderScore).toBe(66 + 0.5 * POINTS_PER_WEIGHT);
    expect(first.reasons[0]).toBe("matches your interest: neurotrophins");
    expect(first.verdict).toBeNull();
  });

  it("is never cached by a CDN", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic });
    const res = await handleFeed(get("/api/me/feed"), ctx(r.store, kalp));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/me/rate", () => {
  const byTopic = { "deep-brain-stimulation": [paper("201", { title: "Adaptive DBS and neurotrophins" })] };
  const body = { pmid: "201", verdict: 1, surface: "web", shownRank: 2, recencyRank: 5, rankerVersion: "p1", topic: "deep-brain-stimulation" };

  it("stores the rating with what was shown, and nudges matched terms by TAP_STEP", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic });
    await r.store.upsertInterests("u-kalp", "obsidian", [{ term: "dbs", weight: 0.4 }]);
    const res = await handleRate(send("POST", "/api/me/rate", body), ctx(r.store, kalp));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pmid: "201", verdict: 1, nudged: ["dbs"] });
    expect(r.ratings.get("u-kalp:201")).toMatchObject({
      userId: "u-kalp", pmid: "201", verdict: 1, shownRank: 2, recencyRank: 5, rankerVersion: "p1", surface: "web", topicId: "t2",
    });
    expect(r.interests.find((i) => i.source === "taps")).toMatchObject({ term: "dbs", weight: TAP_STEP });
  });

  it("a re-tap updates the one row, and flipping the verdict undoes the old nudge", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic });
    await r.store.upsertInterests("u-kalp", "obsidian", [{ term: "dbs", weight: 0.4 }]);
    await handleRate(send("POST", "/api/me/rate", body), ctx(r.store, kalp));
    await handleRate(send("POST", "/api/me/rate", body), ctx(r.store, kalp));
    expect(r.interests.find((i) => i.source === "taps")?.weight).toBe(TAP_STEP);
    await handleRate(send("POST", "/api/me/rate", { ...body, verdict: -1 }), ctx(r.store, kalp));
    expect(r.ratings.size).toBe(1);
    expect(r.ratings.get("u-kalp:201")?.verdict).toBe(-1);
    expect(r.interests.find((i) => i.source === "taps")?.weight).toBe(-TAP_STEP);
  });

  it("400s a malformed body and 404s an unknown paper", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic });
    expect((await handleRate(send("POST", "/api/me/rate", { ...body, verdict: 2 }), ctx(r.store, kalp))).status).toBe(400);
    expect((await handleRate(send("POST", "/api/me/rate", { ...body, surface: "fax" }), ctx(r.store, kalp))).status).toBe(400);
    expect((await handleRate(send("POST", "/api/me/rate", { ...body, pmid: "abc" }), ctx(r.store, kalp))).status).toBe(400);
    expect((await handleRate(send("POST", "/api/me/rate", { ...body, pmid: "404" }), ctx(r.store, kalp))).status).toBe(404);
    const bad = new Request("https://sift.kalpkan.com/api/me/rate", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect((await handleRate(bad, ctx(r.store, kalp))).status).toBe(400);
  });
});

describe("POST /api/me/open", () => {
  it("logs an open with its surface", async () => {
    const r = memoryRadar({ owners: ["u-kalp"], byTopic: { "stem-cells": [paper("7")] } });
    const res = await handleOpen(send("POST", "/api/me/open", { pmid: "7", surface: "widget" }, { authorization: "Bearer good" }), ctx(r.store, kalp));
    expect(res.status).toBe(200);
    expect(r.opens).toEqual([{ userId: "u-kalp", pmid: "7", surface: "widget" }]);
  });
});

describe("/api/me/interests", () => {
  it("GET lists the rows and the combined weights; DELETE removes one", async () => {
    const r = memoryRadar({ owners: ["u-kalp"] });
    await r.store.upsertInterests("u-kalp", "obsidian", [{ term: "dbs", weight: 0.4 }, { term: "aging", weight: 0.3 }]);
    await r.store.upsertInterests("u-kalp", "taps", [{ term: "dbs", weight: 0.1 }]);
    const body = await (await handleInterests(get("/api/me/interests"), ctx(r.store, kalp))).json();
    expect(body.combined).toEqual([{ term: "dbs", weight: 0.5 }, { term: "aging", weight: 0.3 }]);
    expect(body.interests).toHaveLength(3);

    const del = await handleInterests(send("DELETE", "/api/me/interests?term=aging&source=obsidian", undefined), ctx(r.store, kalp));
    expect(del.status).toBe(200);
    expect(r.interests.map((i) => i.term)).toEqual(["dbs", "dbs"]);
    const again = await handleInterests(send("DELETE", "/api/me/interests?term=aging&source=obsidian", undefined), ctx(r.store, kalp));
    expect(again.status).toBe(404);
    const bad = await handleInterests(send("DELETE", "/api/me/interests?term=aging&source=nope", undefined), ctx(r.store, kalp));
    expect(bad.status).toBe(400);
  });
});

describe("/api/me/follows", () => {
  it("GET lists every topic with whether it is followed; PUT replaces the set", async () => {
    const r = memoryRadar();
    const first = await (await handleFollows(get("/api/me/follows"), ctx(r.store, kalp))).json();
    expect(first.topics.filter((t: { followed: boolean }) => t.followed).map((t: { slug: string }) => t.slug)).toEqual([
      "brain-computer-interfaces", "neural-engineering", "deep-brain-stimulation", "stem-cells",
    ]);
    const put = await handleFollows(send("PUT", "/api/me/follows", { slugs: ["neuromodulation"] }), ctx(r.store, kalp));
    expect(put.status).toBe(200);
    expect(r.follows.get("u-kalp")).toEqual(new Set(["t4"]));
    const bad = await handleFollows(send("PUT", "/api/me/follows", { slugs: ["nope"] }), ctx(r.store, kalp));
    expect(bad.status).toBe(400);
  });
});
