/**
 * The feed pipeline: fetch -> store -> rank -> serve, plus the cache policy
 * that decides whether any of that needs to happen at all.
 *
 * Everything here is written against a `FeedStore` interface rather than
 * against supabase-js. That is not ceremony: it means the whole refresh loop,
 * the staleness rule and the failure behaviour are unit-tested against an
 * in-memory store with no database and no network, which is the only way this
 * logic gets tested at all on a $0 budget. lib/supabase-store.ts is the one
 * real implementation.
 */

import { rankPapers, qualityScore, type TopicKind } from "./ranking";
import type { Paper, SourceClient } from "./pubmed";

// ---------------------------------------------------------------------------
// Policy constants
// ---------------------------------------------------------------------------

/**
 * How long a ranked feed is served from cache. Six hours, because new papers
 * appear a few times a day and not a few times a minute (docs/widget-constraints.md:
 * iOS gives a widget 40-70 refreshes a day, so the phone cannot consume more
 * than this anyway), and because every refresh costs two NCBI calls against a
 * shared 3 requests/second budget.
 */
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * How far back each refresh looks. Deliberately much wider than the six-hour
 * cache window: a paper indexed while the server was idle must still be found,
 * and PubMed back-dates records routinely. Overlap is free — the upsert is
 * keyed on PMID, so re-seeing a paper is a no-op.
 */
export const REFRESH_WINDOW_DAYS = 14;

/**
 * Papers pulled per refresh. 120 is one esearch page plus one esummary batch,
 * i.e. exactly two NCBI requests. A hand-tuned query returns roughly 88 papers
 * a week for the broadest seeded topic, so 120 over 14 days is the right order
 * of magnitude without being a second round trip.
 */
export const FETCH_LIMIT = 120;

export const DEFAULT_LIMIT = 10;
/** Nobody gets to pull the whole table through a query string. */
export const MAX_LIMIT = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Topic = {
  id: string;
  slug: string;
  name: string;
  pubmedQuery: string;
  description: string | null;
  kind: TopicKind;
  source: string;
  isActive: boolean;
};

/** A paper as it comes back out of the database, with its score for a topic. */
export type StoredPaper = Paper & {
  score: number;
  reasons: string[];
  rankedAt: string;
  firstSeenAt: string | null;
};

export type ScoreRow = { pmid: string; score: number; reasons: string[]; rankedAt: string };

export type RunResult = { seen: number; added: number; error: string | null };

export interface FeedStore {
  getTopic(slug: string): Promise<Topic | null>;
  listTopics(): Promise<Topic[]>;
  newestRankedAt(topicId: string): Promise<string | null>;
  /** Upserts by PMID; returns how many were new. */
  upsertPapers(papers: Paper[]): Promise<number>;
  upsertScores(topicId: string, rows: ScoreRow[]): Promise<void>;
  readFeed(topicId: string, limit: number): Promise<StoredPaper[]>;
  startRun(topicId: string): Promise<string>;
  finishRun(runId: string, result: RunResult): Promise<void>;
}

/**
 * One paper in the wire format. The field names are NOT arbitrary: they are
 * exactly what `ios/Shared/Paper.swift` decodes, so renaming one breaks the
 * widget silently. `reasons` and `pmid` are additions the Swift `Codable`
 * ignores; the web pages use them.
 */
export type FeedPaper = {
  id: string;
  pmid: string;
  title: string;
  /** Never null: Swift declares it a non-optional String. */
  journal: string;
  authorsShort: string;
  /** Full ISO 8601 with a zone — Swift's `.iso8601` strategy rejects a bare date. */
  published: string;
  doi: string | null;
  url: string | null;
  /** QUALITY only, 0...1. The phone blends its own recency term on top. */
  score: number;
  summary: string | null;
  reasons: string[];
};

/**
 * The feed envelope. `topic` is this repo's documented contract
 * (`{ topic, updatedAt, papers }`); `id`, `name` and `query` are what
 * `ios/Shared/Feed.swift` decodes. Serving the union costs 40 bytes and means
 * one endpoint satisfies both, rather than two endpoints drifting apart.
 */
export type FeedResponse = {
  topic: string;
  id: string;
  name: string;
  query: string;
  updatedAt: string;
  papers: FeedPaper[];
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

export function clampLimit(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)));
}

/**
 * PubMed gives authors as "Zhang C" — surname then initials. The trailing
 * token is the initials when it is short and all-caps, which also leaves
 * multi-word surnames ("van der Berg AB") and collective authors ("Nautilus
 * Study Group") intact.
 */
function surname(author: string): string {
  const parts = author.trim().split(/\s+/);
  if (parts.length < 2) return author.trim();
  const last = parts[parts.length - 1];
  if (/^[A-Z]{1,3}$/.test(last)) return parts.slice(0, -1).join(" ");
  return author.trim();
}

/**
 * The pre-collapsed byline. Built here rather than on the phone because the
 * widget runs in a ~30 MB extension process and must not carry a full author
 * array (docs/widget-constraints.md). Matches `PaperFormatting.authorsShort`.
 */
export function authorsShort(authors: readonly string[]): string {
  const names = authors.map(surname).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} et al.`;
}

export function isStale(rankedAt: string | null, now: Date): boolean {
  if (!rankedAt) return true;
  const t = Date.parse(rankedAt);
  // An unparseable timestamp must mean "refresh", not "trust forever".
  if (Number.isNaN(t)) return true;
  return now.getTime() - t >= REFRESH_AFTER_MS;
}

/** A date-only value becomes midnight UTC; Swift's `.iso8601` needs the time and zone. */
function toIsoInstant(value: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function toFeedPaper(stored: StoredPaper, kind: TopicKind): FeedPaper {
  return {
    id: stored.pmid,
    pmid: stored.pmid,
    title: stored.title,
    journal: stored.journal ?? "",
    authorsShort: authorsShort(stored.authors),
    // A paper with no parseable publication date still has to have a date on
    // the wire, or the whole feed fails to decode on the phone. When we do not
    // know when it was published, when WE first saw it is the honest answer.
    published: toIsoInstant(stored.publishedOn) ?? toIsoInstant(stored.firstSeenAt) ?? new Date(0).toISOString(),
    doi: stored.doi,
    url: stored.url,
    score: qualityScore(stored, kind),
    // No abstract: esummary does not return one, and efetch would double every
    // refresh's NCBI cost for text the widget has no room to show.
    summary: null,
    reasons: stored.reasons,
  };
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function refreshTopic(args: {
  store: FeedStore;
  source: SourceClient;
  topic: Topic;
  now: Date;
}): Promise<{ seen: number; added: number }> {
  const { store, source, topic, now } = args;
  const runId = await store.startRun(topic.id);
  try {
    const { pmids } = await source.searchRecent(topic.pubmedQuery, REFRESH_WINDOW_DAYS, FETCH_LIMIT);
    const papers = pmids.length ? await source.fetchSummaries(pmids) : [];
    const added = await store.upsertPapers(papers);
    const ranked = rankPapers(papers, { now, kind: topic.kind });
    await store.upsertScores(
      topic.id,
      ranked.map((p) => ({ pmid: p.pmid, score: p.score, reasons: p.reasons, rankedAt: now.toISOString() })),
    );
    await store.finishRun(runId, { seen: papers.length, added, error: null });
    return { seen: papers.length, added };
  } catch (e) {
    // The failure mode of a feed is silence: a broken fetch and a quiet week
    // look identical from outside. Always leave a row saying which it was.
    const error = e instanceof Error ? e.message : String(e);
    await store.finishRun(runId, { seen: 0, added: 0, error });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getFeed(args: {
  store: FeedStore;
  source: SourceClient;
  slug: string;
  limit: number;
  now: Date;
  force?: boolean;
}): Promise<FeedResponse | null> {
  const { store, source, slug, limit, now, force = false } = args;
  const topic = await store.getTopic(slug);
  if (!topic) return null;

  const newest = await store.newestRankedAt(topic.id);
  if (force || isStale(newest, now)) {
    try {
      await refreshTopic({ store, source, topic, now });
    } catch (e) {
      // Serving last night's papers beats serving an error page: a stale
      // widget that says how old it is, is honest; an empty one is not.
      // With nothing cached at all there is nothing to serve, so rethrow.
      if (!newest) throw e;
    }
  }

  const rows = await store.readFeed(topic.id, limit);
  const updatedAt =
    rows.map((r) => r.rankedAt).sort().at(-1) ?? newest ?? now.toISOString();

  return {
    topic: topic.slug,
    id: topic.slug,
    name: topic.name,
    query: topic.pubmedQuery,
    updatedAt: new Date(updatedAt).toISOString(),
    papers: rows.map((r) => toFeedPaper(r, topic.kind)),
  };
}
