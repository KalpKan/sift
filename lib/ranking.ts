/**
 * THE RANKER. This is the product.
 *
 * Fetching papers is trivial and free — PubMed's own email alerts already do
 * it. The problem is that one ordinary query (`neuromodulation`, last 7 days)
 * returns 280 papers, and a phone widget shows three. Everything below exists
 * to choose those three.
 *
 * ---------------------------------------------------------------------------
 * HOW GOOD IS THIS? Read this before trusting it.
 * ---------------------------------------------------------------------------
 * It is a hand-weighted linear model over four free signals. It is mediocre,
 * and it is mediocre in a specific, knowable way:
 *
 *   IT MEASURES EVIDENCE TIER AND FORM, NOT IMPORTANCE.
 *
 * A small, dull, methodologically tidy RCT re-testing a settled question will
 * beat a landmark first-in-human case series every single time. It cannot tell
 * a surprising result from a routine one, because nothing in an esummary
 * record says whether the finding was surprising — that lives in the abstract,
 * the discussion, and in what the rest of the field does next. It has no
 * notion of the reader: it does not know what Kalp already read, what he
 * works on this month, or which authors he follows. It cannot read a single
 * word of the actual findings.
 *
 * What it IS good at, and why it is still worth shipping: it reliably removes
 * the noise floor. Case reports, editorials, comments, letters, errata and
 * trial protocols are roughly 10% of the feed, they are never what you meant
 * by "important", and this model buries all of them. It also reliably floats
 * meta-analyses and systematic reviews, which are what you want when the
 * question is "what happened in my field while I was not looking". Going from
 * 280 papers to a defensible 10 is most of the value; picking the true best 3
 * out of those 10 is the part this cannot do.
 *
 * THE SEAM FOR SOMETHING BETTER is `scorePaper` itself: it is pure, it takes
 * a `Paper` plus a context, and it returns a score with reasons. A better
 * ranker — an LLM reading abstracts, a citation-velocity signal, a model
 * trained on which papers Kalp actually opened — drops in behind that exact
 * signature with no change to the routes, the schema or the UI. The `papers.raw`
 * column keeps every original record precisely so a replacement can be
 * back-filled over history without re-fetching from NCBI. `docs/eval/` holds a
 * labelled set to score any replacement against.
 *
 * ---------------------------------------------------------------------------
 * THE EVIDENCE BEHIND THE WEIGHTS
 * ---------------------------------------------------------------------------
 * Two samples were tallied before any weight was chosen.
 *
 * (a) The 200 most recent `neuromodulation` papers, publication types counted:
 *       196 Journal Article      49 Review           13 Case Reports
 *         8 Randomized Controlled Trial               7 Systematic Review
 *         7 English Abstract      5 Comparative Study  5 Observational Study
 *         3 Clinical Trial Protocol  3 Meta-Analysis   3 Multicenter Study
 *         2 Editorial             2 Letter
 *     Conclusions drawn: "Journal Article" is on 98% of records and is worth
 *     exactly zero. The high-evidence tier is ~9% of the feed, which is the
 *     right size for a widget. "Review" is 25% and must be positive but small.
 *
 * (b) 53 papers over 14 days across THREE of Kalp's fields, which corrected
 *     (a) in an important way: 60% carried NO usable publication type at all,
 *     and nearly all of those were in brain-computer interfaces. MeSH
 *     publication types are a CLINICAL-EVIDENCE vocabulary; they have no
 *     category for "we built a device and measured it". A pub-type-only
 *     ranker is therefore blind in Kalp's main field, and would have ranked a
 *     stroke-rehab systematic review above a 4096-channel intraoperative
 *     mapping paper and above a vision-restoration result in blind humans.
 *
 * That is why `TopicKind` exists and why the absence of a publication type is
 * scored at zero and never as a penalty. The engineering path leans on
 * journal, human-subject and scale cues instead — and it is frankly weaker
 * than the clinical path, held together by title regexes. It is the clearest
 * place where a language model reading abstracts would earn its cost, and the
 * first thing to replace.
 */

import { journalTier, journalTierName } from "./journals";
import { ageInDays, type Paper } from "./pubmed";

// Re-exported so callers (and tests) can reach the journal heuristic through
// the ranker, which is the only thing that should be using it.
export { journalTier, journalTierName } from "./journals";

/** Clinical literature is well tagged; engineering literature is not. */
export type TopicKind = "clinical" | "engineering";

export type RankContext = {
  now: Date;
  kind?: TopicKind;
};

export type Score = { score: number; reasons: string[] };

/** One contributing signal: what it adds, and how to say so in the UI. */
export type Component = { points: number; reasons: string[] };

export type RankedPaper = Paper & Score;

export const WEIGHTS = {
  /** Scores start here so an ordinary paper reads as a middling number, not 0. */
  base: 50,
  /**
   * How much to trust publication type. 1.0 for clinical topics, where the
   * tagging is real and dense. 0.35 for engineering topics, where 60% of
   * papers have no type and the tag says more about the sub-literature than
   * about the paper.
   */
  pubTypeWeight: { clinical: 1, engineering: 0.35 } as Record<TopicKind, number>,
  /** Maximum recency bonus, for a paper published today. */
  recencyMax: 20,
  /**
   * Half-life in days. A gentle exponential, deliberately not a cliff: a
   * 30-day-old meta-analysis should still beat today's case report, and it
   * does. At 7 days a paper keeps 85% of its recency bonus, at 90 days 12%.
   */
  recencyHalfLifeDays: 30,
  /** A paper with no parseable date is treated as middle-aged, not as junk. */
  unknownDateAgeDays: 45,
} as const;

// ---------------------------------------------------------------------------
// 1. Publication type — the strongest free signal, where it exists at all
// ---------------------------------------------------------------------------

/**
 * Points per publication type. POSITIVE entries are EVIDENCE TIERS and only
 * the best one counts (see `pubTypeScore`); a systematic review is tagged
 * "Systematic Review" + "Meta-Analysis" + "Review" simultaneously and summing
 * those would triple-count one piece of evidence. NEGATIVE entries are
 * disqualifiers and they all apply.
 */
export const PUB_TYPE_POINTS: Record<string, number> = {
  // --- evidence tiers (best one wins) ---
  "Meta-Analysis": 40,
  "Network Meta-Analysis": 40,
  "Systematic Review": 32,
  // A guideline is a whole field agreeing on what to do. Rarer and more
  // actionable than any single trial, hence just above an RCT.
  "Practice Guideline": 28,
  Guideline: 28,
  "Randomized Controlled Trial": 26,
  "Controlled Clinical Trial": 20,
  "Clinical Trial, Phase III": 20,
  "Clinical Trial, Phase II": 14,
  "Clinical Trial": 12,
  "Clinical Trial, Phase I": 10,
  "Observational Study": 12,
  "Comparative Study": 12,
  "Multicenter Study": 12,
  "Validation Study": 10,
  // A narrative review is 25% of the whole feed. Genuinely useful for keeping
  // up, but it is not evidence, and it must never crowd out an RCT.
  Review: 8,
  // On 98% of records. Carries no information whatsoever. Deliberately zero.
  "Journal Article": 0,
  // A non-English paper with an English abstract. Not a quality signal either
  // way — but worth SAYING, so nobody taps through to a paywalled paper in a
  // language they do not read and feels misled.
  "English Abstract": 0,

  // --- disqualifiers (all apply, on top of any tier) ---
  // Looks like high evidence, reports no results at all. The nastiest trap in
  // the whole vocabulary, because "Randomized Controlled Trial" often sits
  // right next to it.
  "Clinical Trial Protocol": -12,
  "Case Reports": -30,
  Letter: -30,
  Comment: -35,
  Editorial: -35,
  "Published Erratum": -60,
  "Retracted Publication": -80,
  "Retraction of Publication": -80,
};

/** Short, human labels for the tags the UI renders. Keys are publication types. */
const PUB_TYPE_REASON: Record<string, string> = {
  "Meta-Analysis": "meta-analysis",
  "Network Meta-Analysis": "network meta-analysis",
  "Systematic Review": "systematic review",
  "Practice Guideline": "practice guideline",
  Guideline: "guideline",
  "Randomized Controlled Trial": "randomised trial",
  "Controlled Clinical Trial": "controlled trial",
  "Clinical Trial, Phase III": "phase III trial",
  "Clinical Trial, Phase II": "phase II trial",
  "Clinical Trial, Phase I": "phase I trial",
  "Clinical Trial": "clinical trial",
  "Observational Study": "observational study",
  "Comparative Study": "comparative study",
  "Multicenter Study": "multicentre study",
  "Validation Study": "validation study",
  Review: "review",
  "English Abstract": "non-English original",
  "Clinical Trial Protocol": "protocol, no results yet",
  "Case Reports": "case report",
  Letter: "letter",
  Comment: "comment",
  Editorial: "editorial",
  "Published Erratum": "erratum",
  "Retracted Publication": "retracted",
  "Retraction of Publication": "retraction notice",
};

export function pubTypeScore(pubTypes: readonly string[]): Component {
  let bestTier = 0;
  let bestType: string | null = null;
  let penalties = 0;
  const penaltyReasons: string[] = [];
  let neutralNote: string | null = null;

  for (const t of pubTypes) {
    const points = PUB_TYPE_POINTS[t];
    if (points === undefined) continue;
    if (points > 0) {
      if (points > bestTier) {
        bestTier = points;
        bestType = t;
      }
    } else if (points < 0) {
      penalties += points;
      const label = PUB_TYPE_REASON[t];
      if (label) penaltyReasons.push(label);
    } else if (t === "English Abstract") {
      neutralNote = PUB_TYPE_REASON[t];
    }
  }

  const reasons: string[] = [];
  if (bestType) reasons.push(PUB_TYPE_REASON[bestType] ?? bestType.toLowerCase());
  reasons.push(...penaltyReasons);
  if (neutralNote) reasons.push(neutralNote);

  return { points: bestTier + penalties, reasons };
}

// ---------------------------------------------------------------------------
// 2. Recency — a gentle decay
// ---------------------------------------------------------------------------

/**
 * Exponential decay on age. Not a cliff: the single biggest day-to-day drop
 * anywhere on this curve is under half a point, so a paper never falls out of
 * the feed because a threshold ticked over at midnight. Always >= 0, so an
 * old landmark is demoted but never punished.
 *
 * `null` (unparseable date) is treated as middle-aged. Missing metadata is
 * PubMed's fault, not the paper's.
 */
export function recencyPoints(age: number | null): number {
  const days = age === null ? WEIGHTS.unknownDateAgeDays : Math.max(0, age);
  return WEIGHTS.recencyMax * Math.pow(0.5, days / WEIGHTS.recencyHalfLifeDays);
}

function recencyReason(age: number | null): string {
  if (age === null) return "date unknown";
  if (age <= 0) return "published today";
  if (age === 1) return "published yesterday";
  if (age <= 7) return `${age} days old`;
  if (age <= 60) return `${Math.round(age / 7)} weeks old`;
  if (age <= 730) return `${Math.round(age / 30)} months old`;
  return `${Math.round(age / 365)} years old`;
}

// ---------------------------------------------------------------------------
// 3. Title shape
// ---------------------------------------------------------------------------

type TitleRule = { re: RegExp; points: number; reason: string };

/**
 * Titles that announce the paper is not a paper. All anchored at the start,
 * because "in the case of" in the middle of a title is just English.
 */
const TITLE_NEGATIVE: TitleRule[] = [
  { re: /^a case (of|report)\b/i, points: -25, reason: "case report" },
  { re: /^case (report|series|study)\b/i, points: -25, reason: "case report" },
  { re: /^comment(ary)? on\b/i, points: -25, reason: "a comment on another paper" },
  { re: /^(in )?(response|reply) to\b/i, points: -25, reason: "a reply to another paper" },
  { re: /^(the )?(author'?s'? )?(response|reply)\b/i, points: -25, reason: "a reply to another paper" },
  { re: /^re:\s/i, points: -25, reason: "a reply to another paper" },
  { re: /^(erratum|corrigendum|correction to)\b/i, points: -40, reason: "a correction" },
  { re: /^retract(ion|ed)\b/i, points: -60, reason: "a retraction" },
  { re: /^letter to the editor\b/i, points: -25, reason: "a letter" },
  { re: /^editorial\b/i, points: -25, reason: "an editorial" },
];

/**
 * Cues that real humans were involved. This is the signal that rescues the
 * engineering literature: a BCI result in people outranks the Nth offline
 * decoding benchmark, and nothing in the publication types says so.
 */
const TITLE_HUMAN: TitleRule[] = [
  { re: /\bfirst[-\s]in[-\s]human\b/i, points: 14, reason: "first-in-human" },
  { re: /\bin (patients|people|humans|participants|volunteers|subjects)\b/i, points: 8, reason: "human participants" },
  { re: /\b(people|patients|participants) with\b/i, points: 8, reason: "human participants" },
  { re: /\brestor(e|ed|ing|ation)\b/i, points: 6, reason: "restores a lost function" },
  { re: /\bimplant(ed|ation)\b/i, points: 5, reason: "implanted device" },
];

/**
 * Cues for scale and genuine novelty, again mostly for engineering work.
 *
 * OBSERVED FAILURE, and it is the honest limit of regex-on-a-title: these fire
 * on WORDS, not on meaning. A live run put a meta-analysis of "chronic ankle
 * instability" near the top of the neuromodulation feed, partly because
 * `/\bchronic\b/` matched "chronic ankle instability" — which has nothing to do
 * with a chronic implant. The same run showed the sibling problem: that paper
 * only matched the topic at all via a tDCS MeSH term, so it was a topic-match
 * false positive before the ranker ever saw it.
 *
 * Both are fixed by the same thing: reading the abstract (efetch) instead of
 * guessing from the title. That is the first upgrade to make, and it is why
 * the reasons are shown to the reader — "chronic, not acute" next to an ankle
 * paper is visibly wrong, which is the point.
 */
const TITLE_SCALE: TitleRule[] = [
  { re: /\b\d{3,5}[-\s]channel\b/i, points: 10, reason: "very high channel count" },
  { re: /\bhigh[-\s]density\b/i, points: 4, reason: "high-density recording" },
  { re: /\bclosed[-\s]loop\b/i, points: 4, reason: "closed-loop" },
  { re: /\bchronic\b/i, points: 4, reason: "chronic, not acute" },
  { re: /\blong[-\s]term\b/i, points: 4, reason: "long-term follow-up" },
  { re: /^first\b|\bfirst (demonstration|report of|use of)\b/i, points: 6, reason: "claims a first" },
];

/**
 * The house style of an incremental machine-learning paper. These are real
 * markers, not snobbery: a coined architecture name, a benchmark dataset and
 * an accuracy number is a paper about a method, tested offline, on data
 * somebody else collected. There are hundreds a month and they are not what
 * "the important new papers in my field" means.
 *
 * This is the crudest part of the ranker and the most likely to misfire: a
 * genuinely important method paper follows exactly this naming convention too.
 */
const TITLE_INCREMENTAL: TitleRule[] = [
  { re: /\bcross[-\s](session|subject|domain|dataset)\b/i, points: -8, reason: "offline benchmark study" },
  {
    re: /\b(plug[-\s]and[-\s]play|lightweight|novel framework|attention[-\s]based|transformer[-\s]based|dual[-\s]stream|multi[-\s]stream)\b/i,
    points: -5,
    reason: "incremental method paper",
  },
];

/**
 * "TopoAdapter: ...", "DSGF-Net: ...", "SPAR-EEG: ..." — a single coined token
 * before the colon. An ordinary subtitle ("Deep brain stimulation for
 * Parkinson disease: a randomised trial") has spaces before the colon and is
 * left alone. Requiring an internal capital, a hyphen or a digit keeps plain
 * words like "Erratum:" out of this rule (they have their own).
 */
function looksLikeCoinedModelName(title: string): boolean {
  const colon = title.indexOf(":");
  if (colon <= 0) return false;
  const head = title.slice(0, colon).trim();
  if (!head || /\s/.test(head)) return false;
  return /[a-z][A-Z]/.test(head) || /-/.test(head) || /\d/.test(head);
}

const EEG_FAMILY = /\b(eeg|fnirs|emg|meg|ecog|erp)\b/i;
const BENCHMARK_TASK = /\b(decoding|classification|classifier|recognition|accuracy)\b/i;

export function titleScore(title: string): Component {
  let points = 0;
  const reasons: string[] = [];
  const add = (delta: number, reason: string) => {
    points += delta;
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  for (const rule of [...TITLE_NEGATIVE, ...TITLE_HUMAN, ...TITLE_SCALE, ...TITLE_INCREMENTAL]) {
    if (rule.re.test(title)) add(rule.points, rule.reason);
  }
  if (looksLikeCoinedModelName(title)) add(-10, "incremental method paper");
  // A coined name, an EEG-family signal and an accuracy number together are
  // the signature of offline benchmark work.
  if (EEG_FAMILY.test(title) && BENCHMARK_TASK.test(title)) add(-6, "offline benchmark study");

  return { points, reasons };
}

// ---------------------------------------------------------------------------
// 4. Journal — see lib/journals.ts for the long apology
// ---------------------------------------------------------------------------

const JOURNAL_REASON: Record<string, string> = {
  general: "top general journal",
  flagship: "flagship journal in field",
  specialist: "key journal in field",
};

// ---------------------------------------------------------------------------
// scorePaper
// ---------------------------------------------------------------------------

/**
 * Everything except recency: publication type, journal and title shape. Split
 * out because the iPhone client blends its own recency term on-device
 * (`ios/Shared/FeedRanking.swift`, weight 0.35, 3-day half-life), so the score
 * SENT to it must be quality-only or recency is counted twice.
 */
function qualityPoints(paper: Paper, kind: TopicKind): Component {
  const reasons: string[] = [];

  const pt = pubTypeScore(paper.pubTypes);
  reasons.push(...pt.reasons);

  const journal = journalTier(paper.journal);
  const tier = journalTierName(paper.journal);
  if (tier) reasons.push(JOURNAL_REASON[tier]);

  const title = titleScore(paper.title);
  reasons.push(...title.reasons);

  const points = WEIGHTS.base + pt.points * WEIGHTS.pubTypeWeight[kind] + journal + title.points;
  return { points, reasons };
}

/**
 * The domain `qualityPoints` is mapped from when normalising to 0...1.
 * Chosen, not measured: `base` 50 is an ordinary untagged paper (0.45), a
 * meta-analysis in a flagship journal lands near 1.0, a case report near 0.18.
 * Anything outside is clamped, so the range is a presentation choice and can
 * never reorder the feed.
 */
export const QUALITY_RANGE = { min: 0, max: 110 } as const;

/**
 * Quality in 0...1, WITHOUT recency, for the iOS client. The server still
 * orders the stored feed by the full `scorePaper` value; this is only the
 * number the phone re-blends.
 */
export function qualityScore(paper: Paper, kind: TopicKind = "clinical"): number {
  const { points } = qualityPoints(paper, kind);
  const t = (points - QUALITY_RANGE.min) / (QUALITY_RANGE.max - QUALITY_RANGE.min);
  return Math.min(1, Math.max(0, Math.round(t * 1000) / 1000));
}

/**
 * Pure and deterministic: the only input that varies is `context.now`, which
 * the caller supplies. Never reads the clock itself, so a test can pin it.
 */
export function scorePaper(paper: Paper, context: RankContext): Score {
  const kind = context.kind ?? "clinical";
  const quality = qualityPoints(paper, kind);

  const age = ageInDays(paper.publishedOn, context.now);
  const recency = recencyPoints(age);

  // Recency reason first: it is the one every paper has, so the tag row never
  // starts empty and never reflows as signals come and go.
  const reasons = [recencyReason(age), ...quality.reasons];
  return { score: Math.round(quality.points + recency), reasons };
}

/**
 * Score everything and sort. The tie-break chain (score, then date, then PMID)
 * is a TOTAL order, so the output does not depend on the input order — which
 * matters because PubMed does not guarantee one and the widget must not
 * reshuffle between refreshes for no reason.
 */
export function rankPapers(papers: readonly Paper[], context: RankContext): RankedPaper[] {
  return papers
    .map((p) => ({ ...p, ...scorePaper(p, context) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.publishedOn ?? "").localeCompare(a.publishedOn ?? "") ||
        a.pmid.localeCompare(b.pmid),
    );
}
