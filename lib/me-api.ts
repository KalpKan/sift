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
  MAX_BOOST,
  RANKER_VERSION,
  combineInterests,
  matchTerms,
  radarInterests,
  rankPersonal,
  type Candidate,
  type InterestRow,
  type InterestSource,
  type TapRating,
} from "./personal";
import { QUALITY_RANGE, WEIGHTS } from "./ranking";

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
  /** The interest terms the FIRST tap matched; kept on every re-tap (migration 0004). */
  matchedTerms: string[];
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
  /** Stored Obsidian / manual rows. Tap weights are never stored; they are derived from ratings. */
  listInterests(userId: string): Promise<InterestRow[]>;
  /** Returns how many rows were deleted. */
  deleteInterest(userId: string, term: string, source: InterestSource): Promise<number>;
  getPaper(pmid: string): Promise<{ pmid: string; title: string; journal: string | null } | null>;
  /** pmid -> { verdict, matchedTerms }, for this user. */
  getRatings(userId: string): Promise<Map<string, TapRating>>;
  /**
   * One atomic upsert per (user, pmid). With keepMatchedTerms the stored
   * matched_terms are left as the first tap wrote them.
   */
  upsertRating(row: RatingRow, opts: { keepMatchedTerms: boolean }): Promise<void>;
  insertOpen(row: { userId: string; pmid: string; surface: Surface }): Promise<void>;
}

export type MeContext = { radar: RadarStore; viewer: ViewerDeps; now: Date };

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

/**
 * One paper in the private feed: the public FeedPaper plus what the eval needs.
 * `score` here is p1 on a fixed 0..1 scale (P1_SCALE), because the iPhone app
 * sorts by `score`; h1 stays available as `h1` (raw) and `h1Quality` (0..1).
 */
export type MePaper = FeedPaper & {
  h1: number;
  h1Quality: number;
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

/**
 * The most a p1 score can be: h1's top quality, its full recency bonus, plus
 * the interest cap. Dividing by it puts p1 on a fixed 0..1 scale, monotonic in
 * p1 and comparable across days (unlike dividing by today's best paper).
 */
export const P1_SCALE = QUALITY_RANGE.max + WEIGHTS.recencyMax + MAX_BOOST;

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
  const ranked = rankPersonal(candidates, radarInterests(interests, [...ratings.values()]), { now, limit });
  const kinds = new Map(followed.map((t) => [t.slug, t.kind]));

  const newest = candidates.map((c) => c.paper.rankedAt).sort().at(-1);
  return {
    topic: "me",
    id: "me",
    name: ME_FEED_NAME,
    query: followed.map((t) => t.name).join(", "),
    updatedAt: new Date(newest ?? now.toISOString()).toISOString(),
    rankerVersion: RANKER_VERSION,
    papers: ranked.map((p) => {
      const base = toFeedPaper({ ...p.paper, reasons: p.reasons, score: p.paper.score }, kinds.get(p.topic) ?? p.kind);
      return {
        ...base,
        // p1, 0..1: what the app sorts by. (The app should still show server
        // order and send shownRank as given: the 48-hour rule can lift a paper
        // above a higher score.)
        score: Math.round(Math.min(1, Math.max(0, p.p1 / P1_SCALE)) * 1000) / 1000,
        // The number the web list shows, which for this feed is p1.
        orderScore: p.p1,
        h1: p.h1,
        h1Quality: base.score,
        topic: p.topic,
        shownRank: p.shownRank,
        recencyRank: p.recencyRank,
        rankerVersion: RANKER_VERSION,
        verdict: ratings.get(p.paper.pmid)?.verdict ?? null,
      };
    }),
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

  // The server decides which terms a tap moves, from the paper as stored and
  // the WHOLE Obsidian/manual term set (a term whose weight has reached 0 must
  // still be learnable), never from anything the client says. A re-tap keeps
  // the first tap's terms, so flipping a verdict undoes exactly that tap.
  const matched = previous
    ? [...previous.matchedTerms]
    : matchTerms(paper, interests.filter((i) => i.source !== "taps").map((i) => i.term));

  await ctx.radar.upsertRating(
    {
      userId,
      pmid: body.pmid,
      topicId: topics.find((t) => t.slug === body.topic)?.id ?? null,
      verdict: body.verdict,
      shownRank: body.shownRank,
      recencyRank: body.recencyRank,
      rankerVersion: body.rankerVersion,
      surface: body.surface,
      matchedTerms: matched,
    },
    { keepMatchedTerms: previous !== null },
  );
  return json({ ok: true, pmid: body.pmid, verdict: body.verdict, nudged: matched });
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
  // Tap weights are derived from ratings, so there is no taps row to delete.
  source: z.enum(["obsidian", "manual"]),
});

export async function handleInterests(request: Request, ctx: MeContext): Promise<Response> {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  const userId = g.user.id;

  if (request.method === "DELETE") {
    // In the body, not the query string, so a term never lands in an access log.
    const parsed = deleteInterestSchema.safeParse(await readJson(request));
    if (!parsed.success) return error(400, "expected a JSON body {term, source: obsidian|manual}");
    const n = await ctx.radar.deleteInterest(userId, parsed.data.term, parsed.data.source);
    if (n === 0) return error(404, "no such interest");
    return json({ ok: true, deleted: n });
  }

  const [rows, ratings] = await Promise.all([ctx.radar.listInterests(userId), ctx.radar.getRatings(userId)]);
  const all = radarInterests(rows, [...ratings.values()]);
  return json({
    interests: [...all].sort((a, b) => a.term.localeCompare(b.term) || a.source.localeCompare(b.source)),
    combined: combineInterests(all),
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
