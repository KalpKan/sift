import { describe, expect, it } from "vitest";
import type { StoredPaper } from "./feed";
import {
  MAX_BOOST,
  MAX_MUTE,
  POINTS_PER_WEIGHT,
  RANKER_VERSION,
  TAP_STEP,
  applyTapDeltas,
  combineInterests,
  isRecent,
  normalizeTerm,
  personalScore,
  rankPersonal,
  tapDeltas,
  termMatches,
  type Candidate,
} from "./personal";

const NOW = new Date("2026-11-12T12:00:00Z");

function paper(over: Partial<StoredPaper> & { pmid: string }): StoredPaper {
  return {
    title: "A paper",
    journal: "Brain Stimulation",
    authors: ["Doe J"],
    doi: null,
    url: `https://pubmed.ncbi.nlm.nih.gov/${over.pmid}/`,
    publishedOn: "2026-11-01",
    datePrecision: "day",
    pubTypes: [],
    raw: null,
    score: 60,
    reasons: ["review"],
    rankedAt: "2026-11-12T06:00:00Z",
    firstSeenAt: "2026-11-02T06:00:00Z",
    ...over,
  };
}

function cand(p: StoredPaper, topic = "deep-brain-stimulation"): Candidate {
  return { paper: p, topic, kind: "clinical" };
}

describe("RANKER_VERSION", () => {
  it("is p1, stored with every rating", () => {
    expect(RANKER_VERSION).toBe("p1");
  });
});

describe("normalizeTerm", () => {
  it("lower-cases, trims and collapses whitespace", () => {
    expect(normalizeTerm("  Gene   Therapy ")).toBe("gene therapy");
  });
  it("strips wikilink brackets and a leading hash", () => {
    expect(normalizeTerm("[[DBS]]")).toBe("dbs");
    expect(normalizeTerm("#seeg")).toBe("seeg");
  });
});

describe("termMatches", () => {
  it("matches whole words, case-insensitively", () => {
    expect(termMatches("Adaptive DBS for Parkinson's disease", "dbs")).toBe(true);
    expect(termMatches("Results from the SDBSX cohort", "dbs")).toBe(false);
  });
  it("matches multi-word terms across hyphens and spaces", () => {
    expect(termMatches("AAV gene-therapy in mice", "gene therapy")).toBe(true);
    expect(termMatches("Gene therapy for SCA3", "gene therapy")).toBe(true);
    expect(termMatches("Therapy for gene carriers", "gene therapy")).toBe(false);
  });
  it("matches a hyphenated term written as one word", () => {
    expect(termMatches("p75NTR signalling after injury", "p75-ntr")).toBe(true);
  });
  it("tolerates a plural on either side", () => {
    expect(termMatches("Neurotrophin signalling in ageing", "neurotrophins")).toBe(true);
    expect(termMatches("Mitochondrion dynamics", "mitochondria")).toBe(false);
    expect(termMatches("Organoids model the cortex", "organoid")).toBe(true);
  });
  it("never matches an empty term", () => {
    expect(termMatches("anything", "")).toBe(false);
  });
});

describe("combineInterests", () => {
  it("sums one term's weights across sources and clamps to [-1, 1]", () => {
    const out = combineInterests([
      { term: "dbs", weight: 0.4, source: "obsidian" },
      { term: "dbs", weight: 0.15, source: "taps" },
      { term: "aging", weight: 0.9, source: "obsidian" },
      { term: "aging", weight: 0.9, source: "manual" },
      { term: "mice", weight: -0.5, source: "manual" },
    ]);
    expect(out).toEqual([
      { term: "aging", weight: 1 },
      { term: "dbs", weight: 0.55 },
      { term: "mice", weight: -0.5 },
    ]);
  });
  it("drops terms whose weights cancel out", () => {
    expect(combineInterests([
      { term: "x", weight: 0.05, source: "taps" },
      { term: "x", weight: -0.05, source: "manual" },
    ])).toEqual([]);
  });
});

describe("personalScore", () => {
  const interests = [
    { term: "dbs", weight: 0.5 },
    { term: "parkinsons", weight: 0.25 },
    { term: "mice", weight: -0.5 },
  ];

  it("adds weight x POINTS_PER_WEIGHT for each interest hit in the title or journal, with a reason each", () => {
    const s = personalScore({ title: "Adaptive DBS in Parkinsons", journal: "Brain" }, 60, interests);
    expect(s.score).toBe(60 + 0.75 * POINTS_PER_WEIGHT);
    expect(s.matched).toEqual(["dbs", "parkinsons"]);
    expect(s.reasons).toEqual(["matches your interest: dbs", "matches your interest: parkinsons"]);
  });

  it("subtracts for a muted term and says so", () => {
    const s = personalScore({ title: "DBS in mice", journal: null }, 60, interests);
    expect(s.score).toBe(60 + 0.5 * POINTS_PER_WEIGHT - 0.5 * POINTS_PER_WEIGHT);
    expect(s.muted).toEqual(["mice"]);
    expect(s.reasons).toContain("you muted: mice");
  });

  it("caps the boost and the mute so h1's evidence signals still matter", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ term: `t${i}`, weight: 1 }));
    const title = many.map((m) => m.term).join(" ");
    expect(personalScore({ title, journal: null }, 60, many).score).toBe(60 + MAX_BOOST);
    const mutes = many.map((m) => ({ term: m.term, weight: -1 }));
    expect(personalScore({ title, journal: null }, 60, mutes).score).toBe(60 - MAX_MUTE);
  });

  it("is h1 unchanged with no interests", () => {
    const s = personalScore({ title: "Anything", journal: null }, 71, []);
    expect(s).toEqual({ score: 71, boost: 0, matched: [], muted: [], reasons: [] });
  });
});

describe("isRecent", () => {
  it("is true when published or first seen within 48 hours", () => {
    expect(isRecent(paper({ pmid: "1", publishedOn: "2026-11-11" }), NOW)).toBe(true);
    expect(isRecent(paper({ pmid: "1", publishedOn: "2026-10-01", firstSeenAt: "2026-11-11T13:00:00Z" }), NOW)).toBe(true);
    expect(isRecent(paper({ pmid: "1", publishedOn: "2026-11-01", firstSeenAt: "2026-11-02T00:00:00Z" }), NOW)).toBe(false);
  });
});

describe("rankPersonal", () => {
  it("dedupes by PMID across topics, keeping the higher h1 and its topic", () => {
    const out = rankPersonal(
      [cand(paper({ pmid: "1", score: 50 }), "bci"), cand(paper({ pmid: "1", score: 70 }), "dbs"), cand(paper({ pmid: "2", score: 60 }))],
      [],
      { now: NOW, limit: 10 },
    );
    expect(out.map((p) => p.paper.pmid)).toEqual(["1", "2"]);
    expect(out[0].topic).toBe("dbs");
    expect(out[0].h1).toBe(70);
  });

  it("re-orders by p1, so an interest match can overtake a better-evidenced paper", () => {
    const out = rankPersonal(
      [cand(paper({ pmid: "1", score: 80, title: "A meta-analysis of tremor" })), cand(paper({ pmid: "2", score: 65, title: "Neurotrophins after DBS" }))],
      [{ term: "neurotrophins", weight: 0.6, source: "obsidian" }],
      { now: NOW, limit: 10 },
    );
    expect(out.map((p) => p.paper.pmid)).toEqual(["2", "1"]);
    expect(out[0].p1).toBe(65 + 0.6 * POINTS_PER_WEIGHT);
    expect(out[0].reasons).toEqual(["matches your interest: neurotrophins", "review"]);
  });

  it("numbers shownRank 1..n and recencyRank by newest-first over the whole candidate set", () => {
    const out = rankPersonal(
      [
        cand(paper({ pmid: "1", score: 90, publishedOn: "2026-10-01" })),
        cand(paper({ pmid: "2", score: 80, publishedOn: "2026-11-05" })),
        cand(paper({ pmid: "3", score: 10, publishedOn: "2026-11-09" })),
      ],
      [],
      { now: NOW, limit: 2 },
    );
    expect(out.map((p) => [p.paper.pmid, p.shownRank, p.recencyRank])).toEqual([
      ["1", 1, 3],
      ["2", 2, 2],
    ]);
  });

  it("puts the best paper from the last 48 hours into the top 3 when none is there", () => {
    const old = (pmid: string, score: number) => cand(paper({ pmid, score, publishedOn: "2026-10-20", firstSeenAt: "2026-10-21T00:00:00Z" }));
    const out = rankPersonal(
      [old("1", 90), old("2", 85), old("3", 80), old("4", 75),
        cand(paper({ pmid: "5", score: 20, publishedOn: "2026-11-11" })),
        cand(paper({ pmid: "6", score: 30, publishedOn: "2026-11-12" }))],
      [],
      { now: NOW, limit: 5 },
    );
    expect(out.map((p) => p.paper.pmid)).toEqual(["1", "2", "6", "3", "4"]);
    expect(out.map((p) => p.shownRank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("leaves the order alone when a recent paper is already in the top 3, or none exists", () => {
    const out = rankPersonal(
      [cand(paper({ pmid: "1", score: 90, publishedOn: "2026-10-01" })), cand(paper({ pmid: "2", score: 80, publishedOn: "2026-11-12" }))],
      [],
      { now: NOW, limit: 5 },
    );
    expect(out.map((p) => p.paper.pmid)).toEqual(["1", "2"]);
  });

  it("breaks ties deterministically (newer first, then PMID)", () => {
    const a = rankPersonal(
      [cand(paper({ pmid: "9", score: 50 })), cand(paper({ pmid: "10", score: 50 })), cand(paper({ pmid: "11", score: 50, publishedOn: "2026-11-03" }))],
      [],
      { now: NOW, limit: 10 },
    );
    expect(a.map((p) => p.paper.pmid)).toEqual(["11", "10", "9"]);
  });
});

describe("tap learning", () => {
  it("a thumbs-up nudges each matched term up by TAP_STEP, a thumbs-down down", () => {
    expect(tapDeltas(null, 1, ["dbs", "seeg"])).toEqual([{ term: "dbs", delta: TAP_STEP }, { term: "seeg", delta: TAP_STEP }]);
    expect(tapDeltas(null, -1, ["dbs"])).toEqual([{ term: "dbs", delta: -TAP_STEP }]);
  });
  it("a re-tap with the same verdict changes nothing, and flipping undoes the old nudge", () => {
    expect(tapDeltas(1, 1, ["dbs"])).toEqual([]);
    expect(tapDeltas(1, -1, ["dbs"])).toEqual([{ term: "dbs", delta: -2 * TAP_STEP }]);
  });
  it("applies deltas to the existing taps weights, clamped to [-1, 1] and rounded", () => {
    const now = applyTapDeltas(new Map([["dbs", 0.98], ["x", 0.1]]), [
      { term: "dbs", delta: 0.05 },
      { term: "x", delta: -0.05 },
      { term: "new", delta: 0.05 },
    ]);
    expect(now).toEqual([
      { term: "dbs", weight: 1 },
      { term: "x", weight: 0.05 },
      { term: "new", weight: 0.05 },
    ]);
  });
});
