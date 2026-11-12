/**
 * The private radar API, as plain `(Request, context) => Response` handlers so
 * that every status code and every byte of the JSON is unit-tested against an
 * in-memory store. The route files under app/api/me/ only wire in the real
 * context (lib/me-context.ts).
 *
 * Status semantics (lib/access.ts): 401 signed out or bad token, 403 signed in
 * but not an owner, 400 malformed input, 404 unknown paper or interest.
 * Every response is `Cache-Control: no-store`: these are personal rows and no
 * CDN may ever hold one.
 */

import { z } from "zod";
import { resolveViewer, type AuthUser, type ViewerDeps } from "./access";
import { clampLimit, toFeedPaper, type FeedPaper, type Topic } from "./feed";
import {
  RANKER_VERSION,
  applyTapDeltas,
  combineInterests,
  personalScore,
  rankPersonal,
  tapDeltas,
  type Candidate,
  type Interest,
  type InterestRow,
  type InterestSource,
} from "./personal";

// ---------------------------------------------------------------------------
// The store the handlers need
// ---------------------------------------------------------------------------

export type Surface = "web" | "ios" | "widget";
export type Verdict = -1 | 1;

export type RatingRow = {
  userId: string;
  pmid: string;
  topicId: string | null;
  verdict: Verdict;
  shownRank: number;
  recencyRank: number;
  rankerVersion: string;
  surface: Surface;
};

export interface RadarStore {
  isOwner(userId: string): Promise<boolean>;
  createOwner(userId: string, followSlugs: readonly string[]): Promise<void>;
  /** Every active topic. */
  listTopics(): Promise<Topic[]>;
  /** Followed topic ids. */
  listFollows(userId: string): Promise<string[]>;
  setFollows(userId: string, topicIds: readonly string[]): Promise<void>;
  /** The h1-ranked papers from each topic's latest refresh (lib/radar-store.ts). */
  readCandidates(topics: readonly Topic[], now: Date): Promise<Candidate[]>;
  listInterests(userId: string): Promise<InterestRow[]>;
  /** Returns how many rows were deleted. */
  deleteInterest(userId: string, term: string, source: InterestSource): Promise<number>;
  upsertInterests(userId: string, source: InterestSource, rows: readonly Interest[]): Promise<void>;
  getPaper(pmid: string): Promise<{ pmid: string; title: string; journal: string | null } | null>;
  /** pmid -> verdict, for this user. */
  getRatings(userId: string): Promise<Map<string, Verdict>>;
  upsertRating(row: RatingRow): Promise<void>;
  insertOpen(row: { userId: string; pmid: string; surface: Surface }): Promise<void>;
}

export type MeContext = { radar: RadarStore; viewer: ViewerDeps; now: Date };

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

/** One paper in the private feed: the public FeedPaper plus what the eval needs. */
export type MePaper = FeedPaper & {
  /** The followed topic that ranked it highest. */
  topic: string;
  shownRank: number;
  recencyRank: number;
  rankerVersion: string;
  /** The reader's current rating, so a UI can show it. */
  verdict: Verdict | null;
};

/**
 * Same envelope as `/api/feed`, so `ios/Shared/Feed.swift` decodes it
 * unchanged (`id`, `name`, `query`, `updatedAt`, `papers`); unknown keys are
 * ignored by Swift's Codable.
 */
export type MeFeedResponse = {
  topic: "me";
  id: "me";
  name: string;
  query: string;
  updatedAt: string;
  rankerVersion: string;
  papers: MePaper[];
};

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

const error = (status: number, message: string, headers: Record<string, string> = {}) =>
  json({ error: message }, status, headers);

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

/**
 * Cookie-authenticated writes must come from this site. The session cookie is
 * SameSite=Lax already; this is the belt to that braces. A bearer request
 * (the iPhone app) carries no ambient credential, so it is exempt.
 */
function crossOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  if (request.headers.get("authorization")) return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

async function guard(request: Request, ctx: MeContext): Promise<{ user: AuthUser } | Response> {
  const v = await resolveViewer(request.headers.get("authorization"), ctx.viewer);
  if (v.status === 401) return error(401, "sign in required", { "WWW-Authenticate": "Bearer" });
  if (v.status === 403) return error(403, "this radar is private");
  if (crossOrigin(request)) return error(403, "cross-origin request refused");
  return { user: v.user };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const pmidSchema = z.string().regex(/^\d{1,10}$/);
const surfaceSchema = z.enum(["web", "ios", "widget"]);

// ---------------------------------------------------------------------------
// The feed
// ---------------------------------------------------------------------------

export const ME_FEED_NAME = "My radar";

/** Build the private feed. Exported for the /me page, which renders it directly. */
export async function buildMeFeed(
  ctx: Pick<MeContext, "radar" | "now">,
  userId: string,
  limit: number,
): Promise<MeFeedResponse> {
  const { radar, now } = ctx;
  const [topics, followIds, interests, ratings] = await Promise.all([
    radar.listTopics(),
    radar.listFollows(userId),
    radar.listInterests(userId),
    radar.getRatings(userId),
  ]);
  const followed = topics.filter((t) => followIds.includes(t.id));
  const candidates = followed.length ? await radar.readCandidates(followed, now) : [];
  const ranked = rankPersonal(candidates, interests, { now, limit });
  const kinds = new Map(followed.map((t) => [t.slug, t.kind]));

  const newest = candidates.map((c) => c.paper.rankedAt).sort().at(-1);
  return {
    topic: "me",
    id: "me",
    name: ME_FEED_NAME,
    query: followed.map((t) => t.name).join(", "),
    updatedAt: new Date(newest ?? now.toISOString()).toISOString(),
    rankerVersion: RANKER_VERSION,
    papers: ranked.map((p) => ({
      ...toFeedPaper({ ...p.paper, reasons: p.reasons, score: p.paper.score }, kinds.get(p.topic) ?? p.kind),
      // The number the list is sorted by, which for this feed is p1.
      orderScore: p.p1,
      topic: p.topic,
      shownRank: p.shownRank,
      recencyRank: p.recencyRank,
      rankerVersion: RANKER_VERSION,
      verdict: ratings.get(p.paper.pmid) ?? null,
    })),
  };
}

export async function handleFeed(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const limit = clampLimit(new URL(request.url).searchParams.get("limit"));
  return json(await buildMeFeed(ctx, g.user.id, limit));
}

// ---------------------------------------------------------------------------
// Rate
// ---------------------------------------------------------------------------

const rateSchema = z.object({
  pmid: pmidSchema,
  verdict: z.union([z.literal(1), z.literal(-1)]),
  surface: surfaceSchema,
  shownRank: z.number().int().min(1).max(1000),
  recencyRank: z.number().int().min(1).max(100000),
  rankerVersion: z.string().regex(/^[a-z0-9._-]{1,16}$/i),
  topic: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
});

export async function handleRate(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const parsed = rateSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(400, "expected {pmid, verdict: 1|-1, surface, shownRank, recencyRank, rankerVersion, topic?}");
  const body = parsed.data;
  const userId = g.user.id;

  const paper = await ctx.radar.getPaper(body.pmid);
  if (!paper) return error(404, `unknown paper: ${body.pmid}`);

  const [topics, interests, ratings] = await Promise.all([
    ctx.radar.listTopics(),
    ctx.radar.listInterests(userId),
    ctx.radar.getRatings(userId),
  ]);
  const previous = ratings.get(body.pmid) ?? null;

  await ctx.radar.upsertRating({
    userId,
    pmid: body.pmid,
    topicId: topics.find((t) => t.slug === body.topic)?.id ?? null,
    verdict: body.verdict,
    shownRank: body.shownRank,
    recencyRank: body.recencyRank,
    rankerVersion: body.rankerVersion,
    surface: body.surface,
  });

  // The server decides which terms a tap nudges, from the paper as stored,
  // never from anything the client says.
  const s = personalScore(paper, 0, combineInterests(interests));
  const touched = [...s.matched, ...s.muted];
  const deltas = tapDeltas(previous, body.verdict, touched);
  if (deltas.length) {
    const taps = new Map(interests.filter((i) => i.source === "taps").map((i) => [i.term, i.weight]));
    await ctx.radar.upsertInterests(userId, "taps", applyTapDeltas(taps, deltas));
  }
  return json({ ok: true, pmid: body.pmid, verdict: body.verdict, nudged: deltas.map((d) => d.term) });
}

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

const openSchema = z.object({ pmid: pmidSchema, surface: surfaceSchema });

export async function handleOpen(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const parsed = openSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(400, "expected {pmid, surface: web|ios|widget}");
  if (!(await ctx.radar.getPaper(parsed.data.pmid))) return error(404, `unknown paper: ${parsed.data.pmid}`);
  await ctx.radar.insertOpen({ userId: g.user.id, pmid: parsed.data.pmid, surface: parsed.data.surface });
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------

const deleteInterestSchema = z.object({
  term: z.string().min(1).max(64),
  source: z.enum(["obsidian", "taps", "manual"]),
});

export async function handleInterests(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const userId = g.user.id;

  if (request.method === "DELETE") {
    const q = new URL(request.url).searchParams;
    const parsed = deleteInterestSchema.safeParse({ term: q.get("term") ?? undefined, source: q.get("source") ?? undefined });
    if (!parsed.success) return error(400, "expected ?term=<term>&source=obsidian|taps|manual");
    const n = await ctx.radar.deleteInterest(userId, parsed.data.term, parsed.data.source);
    if (n === 0) return error(404, "no such interest");
    return json({ ok: true, deleted: n });
  }

  const rows = await ctx.radar.listInterests(userId);
  return json({
    interests: [...rows].sort((a, b) => a.term.localeCompare(b.term) || a.source.localeCompare(b.source)),
    combined: combineInterests(rows),
  });
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

const followsSchema = z.object({ slugs: z.array(z.string().max(64)).max(50) });

export async function handleFollows(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const userId = g.user.id;
  const topics = await ctx.radar.listTopics();

  if (request.method === "PUT") {
    const parsed = followsSchema.safeParse(await readJson(request));
    if (!parsed.success) return error(400, "expected {slugs: string[]}");
    const ids = parsed.data.slugs.map((s) => topics.find((t) => t.slug === s)?.id);
    if (ids.some((id) => !id)) return error(400, "unknown topic slug");
    await ctx.radar.setFollows(userId, ids as string[]);
  }

  const followed = new Set(await ctx.radar.listFollows(userId));
  return json({ topics: topics.map((t) => ({ slug: t.slug, name: t.name, followed: followed.has(t.id) })) });
}
