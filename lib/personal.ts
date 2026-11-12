/**
 * THE PERSONAL RANKER, `p1`. Pure: no database, no clock, no network.
 *
 * `h1` (lib/ranking.ts) is the shared, public ranker: evidence tier, recency,
 * journal and title shape. It knows nothing about the reader. `p1` is `h1`
 * plus the reader's interest terms:
 *
 *     p1 = h1 + clamp(sum of weight x POINTS_PER_WEIGHT over interest terms
 *                     found in the title or journal, -MAX_MUTE, +MAX_BOOST)
 *
 * Interest terms come from three places (sift.interests.source): Kalp's
 * `[[research]]`-tagged Obsidian notes (scripts/obsidian-interests.mjs),
 * his taps (each thumbs-up nudges the matched terms up by TAP_STEP, each
 * thumbs-down down), and terms typed by hand. A negative weight is a mute.
 *
 * WHAT IT CANNOT SEE: MeSH terms and abstracts. PubMed's esummary, which is
 * all Sift fetches, carries neither, so a term only matches when the title or
 * the journal name says it. "bci" will miss a paper titled "Intracortical
 * speech decoding in ...". That is the known ceiling of `p1`; efetch (MeSH +
 * abstract) is the upgrade, and `npm run eval` is how to tell whether it is
 * needed.
 *
 * The caps are the design: an interest match is worth about as much as a
 * strong evidence signal (a systematic review is +32 in h1), never more than
 * MAX_BOOST, so a case report that happens to say "bci" cannot leapfrog every
 * meta-analysis in the feed.
 */

import type { StoredPaper } from "./feed";
import type { TopicKind } from "./ranking";

export const RANKER_VERSION = "p1";

/** A weight of 1.0 is worth this many h1 points. */
export const POINTS_PER_WEIGHT = 40;
/** The most interest terms can add to one paper. */
export const MAX_BOOST = 40;
/** The most mutes can take away from one paper. */
export const MAX_MUTE = 40;
/** How far one thumbs-up or thumbs-down moves each matched term. */
export const TAP_STEP = 0.05;
/** "Recent" for the one-from-the-last-48-hours rule. */
export const RECENT_MS = 48 * 60 * 60 * 1000;
/** The 48-hour rule guarantees a recent paper within this many slots. */
export const RECENT_SLOT = 3;

export type InterestSource = "obsidian" | "taps" | "manual";
export type InterestRow = { term: string; weight: number; source: InterestSource };
export type Interest = { term: string; weight: number };

const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/** "[[Spindle  Cells]]" -> "spindle cells". The one canonical form stored. */
export function normalizeTerm(raw: string): string {
  return raw
    .replace(/^\s*#/, "")
    .replace(/\[\[|\]\]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Lower-case alphanumeric tokens: "K2AB spindle-cells" -> ["k2ab", "spindle", "cells"]. */
function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** One trailing "s" is not a different word ("organoid" / "organoids"). */
function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Whole-word, case-insensitive. A multi-word or hyphenated term matches the
 * same words in sequence, separated by anything, or run together as one word
 * ("k2-ab" matches "K2AB"). Substrings never match ("bci" is not in
 * "SBCIX").
 */
export function termMatches(text: string, term: string): boolean {
  const want = tokens(term);
  if (want.length === 0) return false;
  const have = tokens(text);
  const wantJoined = singular(want.join(""));
  const wantSpaced = want.map(singular).join(" ");
  for (let i = 0; i < have.length; i++) {
    for (let len = 1; len <= Math.min(want.length + 1, have.length - i); len++) {
      const run = have.slice(i, i + len);
      if (run.map(singular).join(" ") === wantSpaced) return true;
      if (singular(run.join("")) === wantJoined) return true;
    }
  }
  return false;
}

/** One weight per term, summed across sources, clamped to [-1, 1], heaviest first. */
export function combineInterests(rows: readonly InterestRow[]): Interest[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const term = normalizeTerm(r.term);
    if (!term) continue;
    sums.set(term, (sums.get(term) ?? 0) + r.weight);
  }
  return [...sums.entries()]
    .map(([term, w]) => ({ term, weight: round(clamp(w, -1, 1)) }))
    .filter((i) => i.weight !== 0)
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type PersonalScore = {
  score: number;
  boost: number;
  matched: string[];
  muted: string[];
  reasons: string[];
};

export function personalScore(
  paper: { title: string; journal: string | null },
  h1: number,
  interests: readonly Interest[],
): PersonalScore {
  const text = `${paper.title} ${paper.journal ?? ""}`;
  let plus = 0;
  let minus = 0;
  const matched: string[] = [];
  const muted: string[] = [];
  for (const { term, weight } of interests) {
    if (weight === 0 || !termMatches(text, term)) continue;
    if (weight > 0) {
      plus += weight * POINTS_PER_WEIGHT;
      matched.push(term);
    } else {
      minus += -weight * POINTS_PER_WEIGHT;
      muted.push(term);
    }
  }
  const boost = round(Math.min(plus, MAX_BOOST) - Math.min(minus, MAX_MUTE), 2);
  return {
    score: round(h1 + boost, 2),
    boost,
    matched,
    muted,
    reasons: [...matched.map((t) => `matches your interest: ${t}`), ...muted.map((t) => `you muted: ${t}`)],
  };
}

// ---------------------------------------------------------------------------
// The merged feed
// ---------------------------------------------------------------------------

/** One paper as one followed topic ranked it. */
export type Candidate = { paper: StoredPaper; topic: string; kind: TopicKind };

export type PersonalPaper = Candidate & {
  h1: number;
  p1: number;
  /** Personal reasons first, then h1's. */
  reasons: string[];
  /** Interest terms that matched; a tap nudges exactly these. */
  matched: string[];
  /** 1-based position in this feed, i.e. what the reader was shown. */
  shownRank: number;
  /** 1-based position a plain newest-first list would have given it. */
  recencyRank: number;
};

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(t) ? null : t;
}

/** Published, else first seen, else the epoch: what "newest" means for ordering. */
function newestKey(p: StoredPaper): number {
  return dateMs(p.publishedOn) ?? dateMs(p.firstSeenAt) ?? 0;
}

/** PMIDs are numbers that grow with time; compare them as numbers when they are. */
function pmidDesc(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
  return b.localeCompare(a);
}

/**
 * Published, or first seen by Sift, in the last 48 hours. First-seen counts
 * because PubMed back-dates records: a paper indexed today with a "2026 Oct"
 * date is still new to the reader.
 */
export function isRecent(p: StoredPaper, now: Date): boolean {
  const newest = Math.max(dateMs(p.publishedOn) ?? 0, dateMs(p.firstSeenAt) ?? 0);
  return newest > 0 && now.getTime() - newest <= RECENT_MS;
}

export function rankPersonal(
  candidates: readonly Candidate[],
  interestRows: readonly InterestRow[],
  opts: { now: Date; limit: number },
): PersonalPaper[] {
  // 1. Dedupe by PMID: a paper followed through two topics is one paper,
  //    carried by whichever topic ranked it higher.
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const seen = best.get(c.paper.pmid);
    if (!seen || c.paper.score > seen.paper.score) best.set(c.paper.pmid, c);
  }
  const unique = [...best.values()];

  // 2. Newest-first ranks over everything, so a tap records what a plain
  //    chronological list would have shown.
  const recencyRank = new Map<string, number>();
  [...unique]
    .sort((a, b) => newestKey(b.paper) - newestKey(a.paper) || pmidDesc(a.paper.pmid, b.paper.pmid))
    .forEach((c, i) => recencyRank.set(c.paper.pmid, i + 1));

  // 3. Score and sort by p1. Ties: newer first, then the higher PMID.
  const interests = combineInterests(interestRows);
  const scored = unique
    .map((c) => {
      const s = personalScore(c.paper, c.paper.score, interests);
      return { c, s };
    })
    .sort(
      (a, b) =>
        b.s.score - a.s.score ||
        newestKey(b.c.paper) - newestKey(a.c.paper) ||
        pmidDesc(a.c.paper.pmid, b.c.paper.pmid),
    );

  // 4. One paper from the last 48 hours in the top three (docs/plan.md), so a
  //    strong paper from last Monday cannot make the widget look dead all week.
  const top = scored.slice(0, RECENT_SLOT);
  if (top.length === RECENT_SLOT && !top.some((x) => isRecent(x.c.paper, opts.now))) {
    const idx = scored.findIndex((x, i) => i >= RECENT_SLOT && isRecent(x.c.paper, opts.now));
    if (idx >= 0) {
      const [recent] = scored.splice(idx, 1);
      scored.splice(RECENT_SLOT - 1, 0, recent);
    }
  }

  return scored.slice(0, Math.max(0, opts.limit)).map(({ c, s }, i) => ({
    ...c,
    h1: c.paper.score,
    p1: s.score,
    reasons: [...s.reasons, ...c.paper.reasons],
    matched: s.matched,
    shownRank: i + 1,
    recencyRank: recencyRank.get(c.paper.pmid)!,
  }));
}

// ---------------------------------------------------------------------------
// Learning from taps
// ---------------------------------------------------------------------------
//
// Tap weights are DERIVED from the rating rows, never accumulated. Each
// rating stores the terms its first tap matched (sift.ratings.matched_terms,
// migration 0004); a term's tap weight is the sum of verdict x TAP_STEP over
// the ratings that matched it. So:
//   - a re-tap with the same verdict changes nothing (one row per paper);
//   - flipping a verdict undoes exactly what that rating moved;
//   - two taps at once cannot lose a nudge (each is its own atomic upsert);
//   - deleting a term in settings also forgets what taps taught it, because
//     only terms still in the Obsidian/manual set are counted.

/** The interest terms that appear in this paper's title or journal. Weight is irrelevant: a term at 0 still matches. */
export function matchTerms(paper: { title: string; journal: string | null }, terms: readonly string[]): string[] {
  const text = `${paper.title} ${paper.journal ?? ""}`;
  return [...new Set(terms.map(normalizeTerm))].filter((t) => t && termMatches(text, t));
}

export type TapRating = { verdict: 1 | -1; matchedTerms: readonly string[] };

export function tapWeights(ratings: readonly TapRating[], universe: readonly string[]): InterestRow[] {
  const known = new Set(universe.map(normalizeTerm));
  const sums = new Map<string, number>();
  for (const r of ratings) {
    for (const raw of new Set(r.matchedTerms.map(normalizeTerm))) {
      if (known.has(raw)) sums.set(raw, (sums.get(raw) ?? 0) + r.verdict * TAP_STEP);
    }
  }
  return [...sums.entries()]
    .map(([term, w]) => ({ term, weight: round(clamp(w, -1, 1)), source: "taps" as const }))
    .filter((r) => r.weight !== 0);
}

/** The terms p1 ranks with: stored Obsidian/manual rows plus the weights taps derive. */
export function radarInterests(rows: readonly InterestRow[], ratings: readonly TapRating[]): InterestRow[] {
  const base = rows.filter((r) => r.source !== "taps");
  return [...base, ...tapWeights(ratings, base.map((r) => r.term))];
}
