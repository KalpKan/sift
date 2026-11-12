/**
 * The built-in eval (docs/spec.md, "The new acceptance gate"). Pure.
 *
 * Kalp's thumbs are the labels. For the papers he rated, three rankers each put
 * the same set in order, and precision@k is the share of thumbs-up among the
 * first k:
 *
 *   p1            h1 + his Obsidian / hand-typed terms + what his OTHER taps
 *                 taught (leave-one-out, so a paper's own tap never helps rank
 *                 it; otherwise p1 would be graded on its own answers)
 *   h1            the shared public ranker's stored score
 *   newest-first  the plain chronological list p1 has to beat
 *
 * GATE: at least 50 ratings, p1 precision@3 >= 0.6, and p1 beats newest-first
 * at 3 by at least one paper in three. If it does not, ranking work comes
 * before any more UI.
 *
 * KNOWN BIAS, printed with every report: he only rates what he was shown, and
 * he was shown p1's top 10, so the rated set is already p1-shaped.
 */

import {
  TAP_STEP,
  combineInterests,
  personalScore,
  termMatches,
  type InterestRow,
} from "./personal";

export const GATE = { minRatings: 50, minP3: 0.6, minLiftOverNewest: 1 / 3 } as const;

export type RatedPaper = {
  pmid: string;
  verdict: 1 | -1;
  title: string;
  journal: string | null;
  /** The best stored h1 score across the paper's topics. */
  h1: number;
  /** Published (else first seen) as epoch ms: newest-first's key. */
  publishedMs: number;
};

export type MethodResult = { order: string[]; p3: number | null; p10: number | null };
export type EvalReport = {
  n: number;
  positives: number;
  methods: { p1: MethodResult; h1: MethodResult; newest: MethodResult };
  gate: { status: "too-few" | "pass" | "fail"; reason: string };
};

export function precisionAt(ordered: readonly RatedPaper[], k: number): number | null {
  const top = ordered.slice(0, k);
  if (top.length === 0) return null;
  return top.filter((p) => p.verdict === 1).length / top.length;
}

const byPmidDesc = (a: RatedPaper, b: RatedPaper) => b.pmid.localeCompare(a.pmid, undefined, { numeric: true });

function result(ordered: RatedPaper[]): MethodResult {
  return { order: ordered.map((p) => p.pmid), p3: precisionAt(ordered, 3), p10: precisionAt(ordered, 10) };
}

/**
 * Leave-one-out p1 score. Tap weights are rebuilt from the ratings themselves
 * (each tap moves every term its paper matches by TAP_STEP in its direction),
 * minus the paper's own tap; the stored `taps` rows are used only for which
 * terms exist, never for their learned weights.
 */
function p1LeaveOneOut(papers: readonly RatedPaper[], interests: readonly InterestRow[]): Map<string, number> {
  const fixed = interests.filter((i) => i.source !== "taps");
  const terms = [...new Set(combineInterests(interests.map((i) => ({ ...i, weight: 1 }))).map((i) => i.term))];
  const text = (p: RatedPaper) => `${p.title} ${p.journal ?? ""}`;
  const hits = new Map(papers.map((p) => [p.pmid, terms.filter((t) => termMatches(text(p), t))]));

  const total = new Map<string, number>();
  for (const p of papers) for (const t of hits.get(p.pmid)!) total.set(t, (total.get(t) ?? 0) + p.verdict * TAP_STEP);

  const out = new Map<string, number>();
  for (const p of papers) {
    const own = new Set(hits.get(p.pmid));
    const taps: InterestRow[] = [...total.entries()].map(([term, w]) => ({
      term,
      weight: Math.max(-1, Math.min(1, own.has(term) ? w - p.verdict * TAP_STEP : w)),
      source: "taps",
    }));
    out.set(p.pmid, personalScore(p, p.h1, combineInterests([...fixed, ...taps])).score);
  }
  return out;
}

export function evaluate(papers: readonly RatedPaper[], interests: readonly InterestRow[]): EvalReport {
  const p1 = p1LeaveOneOut(papers, interests);
  const methods = {
    p1: result([...papers].sort((a, b) => p1.get(b.pmid)! - p1.get(a.pmid)! || b.publishedMs - a.publishedMs || byPmidDesc(a, b))),
    h1: result([...papers].sort((a, b) => b.h1 - a.h1 || b.publishedMs - a.publishedMs || byPmidDesc(a, b))),
    newest: result([...papers].sort((a, b) => b.publishedMs - a.publishedMs || byPmidDesc(a, b))),
  };
  const n = papers.length;
  let gate: EvalReport["gate"];
  if (n < GATE.minRatings) {
    gate = { status: "too-few", reason: `${n} of ${GATE.minRatings} ratings` };
  } else {
    const p3 = methods.p1.p3 ?? 0;
    const lift = p3 - (methods.newest.p3 ?? 0);
    const ok = p3 >= GATE.minP3 && lift >= GATE.minLiftOverNewest - 1e-9;
    gate = {
      status: ok ? "pass" : "fail",
      reason: `p1@3 ${p3.toFixed(2)} (needs ≥ ${GATE.minP3}), lift over newest-first ${lift.toFixed(2)} (needs ≥ 0.33)`,
    };
  }
  return { n, positives: papers.filter((p) => p.verdict === 1).length, methods, gate };
}

const fmt = (x: number | null) => (x === null ? "  —  " : x.toFixed(2).padStart(5));

export function formatReport(r: EvalReport): string {
  const lines = [
    `ratings: ${r.n} (${r.positives} up, ${r.n - r.positives} down)`,
    "",
    "ranker         P@3    P@10",
    `p1           ${fmt(r.methods.p1.p3)}  ${fmt(r.methods.p1.p10)}   (h1 + interests + leave-one-out tap learning)`,
    `h1           ${fmt(r.methods.h1.p3)}  ${fmt(r.methods.h1.p10)}   (shared public ranker)`,
    `newest-first ${fmt(r.methods.newest.p3)}  ${fmt(r.methods.newest.p10)}   (the list p1 has to beat)`,
    "",
    r.gate.status === "too-few"
      ? `gate: not yet (${r.gate.reason}); needs ≥ ${GATE.minRatings} ratings`
      : `gate: ${r.gate.status.toUpperCase()}: ${r.gate.reason}`,
    "",
    "Known bias: Kalp only rates what he was shown, and he was shown p1's top 10, so every number",
    "here is measured on a set p1 already chose. Treat a pass as necessary, not sufficient.",
  ];
  return lines.join("\n");
}
