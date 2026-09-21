import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSummaries, type Paper } from "./pubmed";
import {
  PUB_TYPE_POINTS,
  WEIGHTS,
  journalTier,
  pubTypeScore,
  rankPapers,
  recencyPoints,
  scorePaper,
  qualityScore,
  titleScore,
} from "./ranking";

const fixtureDir = path.resolve(__dirname, "..", "tests", "fixtures", "pubmed");
const corpus = parseSummaries(
  JSON.parse(readFileSync(path.join(fixtureDir, "esummary-corpus.json"), "utf8")),
);

/** Fixed clock: every assertion about recency must be reproducible forever. */
const NOW = new Date("2026-09-21T00:00:00Z");
const clinical = { now: NOW, kind: "clinical" as const };
const engineering = { now: NOW, kind: "engineering" as const };

function paper(over: Partial<Paper> = {}): Paper {
  return {
    pmid: "1",
    title: "A study of something",
    journal: "Journal of Obscure Results",
    authors: ["A B"],
    doi: null,
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    publishedOn: "2026-09-14",
    datePrecision: "day",
    pubTypes: ["Journal Article"],
    raw: {},
    ...over,
  };
}

describe("the recorded corpus is a real, varied test bed", () => {
  it("has ~30+ real papers spanning every publication type that matters", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(30);
    const all = new Set(corpus.flatMap((p) => p.pubTypes));
    for (const t of [
      "Meta-Analysis",
      "Systematic Review",
      "Randomized Controlled Trial",
      "Practice Guideline",
      "Case Reports",
      "Editorial",
      "Letter",
      "Review",
    ]) {
      expect(all.has(t), t).toBe(true);
    }
  });
});

describe("pubTypeScore", () => {
  it("scores 'Journal Article' at exactly zero, because 98% of records carry it", () => {
    // Measured: 196 of the 200 most recent `neuromodulation` papers. A tag
    // almost every record has carries no information at all.
    expect(PUB_TYPE_POINTS["Journal Article"]).toBe(0);
    expect(pubTypeScore(["Journal Article"]).points).toBe(0);
  });

  it("treats a paper with NO publication type as neutral, never penalised", () => {
    // 60% of papers across Kalp's fields have no usable type, and in
    // brain-computer interfaces almost none do. Penalising absence would bury
    // exactly the engineering landmarks the feed exists to surface.
    expect(pubTypeScore([]).points).toBe(0);
    expect(pubTypeScore(["Journal Article", "English Abstract"]).points).toBe(0);
  });

  it("orders the evidence tiers the way a reader would", () => {
    const of = (...t: string[]) => pubTypeScore(["Journal Article", ...t]).points;
    const metaAnalysis = of("Meta-Analysis");
    const systematicReview = of("Systematic Review");
    const rct = of("Randomized Controlled Trial");
    const observational = of("Observational Study");
    const narrativeReview = of("Review");
    const untagged = of();
    const caseReport = of("Case Reports");
    const editorial = of("Editorial");

    expect(metaAnalysis).toBeGreaterThan(systematicReview);
    expect(systematicReview).toBeGreaterThan(rct);
    expect(rct).toBeGreaterThan(observational);
    expect(observational).toBeGreaterThan(narrativeReview);
    expect(narrativeReview).toBeGreaterThan(untagged);
    expect(untagged).toBeGreaterThan(caseReport);
    expect(caseReport).toBeGreaterThan(editorial);
  });

  it("never lets a bare narrative review outrank an RCT", () => {
    // "Review" is 25% of the whole feed. A narrative review is a useful
    // keeping-up read, but it is not evidence, and it must not crowd out one.
    expect(pubTypeScore(["Journal Article", "Review"]).points).toBeLessThan(
      pubTypeScore(["Journal Article", "Randomized Controlled Trial"]).points,
    );
  });

  it("takes the BEST tier rather than adding tiers together", () => {
    // A real systematic review is tagged "Systematic Review" + "Meta-Analysis"
    // + "Review" all at once. Summing would triple-count one piece of evidence.
    const both = pubTypeScore(["Journal Article", "Systematic Review", "Meta-Analysis", "Review"]).points;
    expect(both).toBe(pubTypeScore(["Meta-Analysis"]).points);
  });

  it("still applies penalties on top of the best tier", () => {
    // An erratum ABOUT a meta-analysis is not a meta-analysis.
    const p = pubTypeScore(["Meta-Analysis", "Published Erratum"]).points;
    expect(p).toBeLessThan(pubTypeScore(["Meta-Analysis"]).points);
    expect(p).toBeLessThan(0);
  });

  it("treats a trial PROTOCOL as a trap, not as high evidence", () => {
    // It looks like a trial and reports no results whatsoever.
    const r = pubTypeScore(["Journal Article", "Clinical Trial Protocol"]);
    expect(r.points).toBeLessThan(0);
    expect(r.reasons.join(" ")).toMatch(/protocol/i);
  });

  it("flags a non-English paper without judging it", () => {
    const r = pubTypeScore(["Journal Article", "English Abstract"]);
    expect(r.points).toBe(0);
    expect(r.reasons.join(" ")).toMatch(/english abstract|translated|non-english/i);
  });

  it("buries case reports, editorials, comments and letters below zero", () => {
    for (const t of ["Case Reports", "Editorial", "Comment", "Letter"]) {
      expect(pubTypeScore(["Journal Article", t]).points, t).toBeLessThan(-20);
    }
  });

  it("explains itself in plain words", () => {
    expect(pubTypeScore(["Journal Article", "Meta-Analysis"]).reasons).toContain("meta-analysis");
    expect(pubTypeScore(["Journal Article", "Case Reports"]).reasons).toContain("case report");
  });
});

describe("recencyPoints", () => {
  it("decays gently, with no cliff", () => {
    const today = recencyPoints(0);
    const week = recencyPoints(7);
    const month = recencyPoints(30);
    const quarter = recencyPoints(90);
    const year = recencyPoints(365);
    expect(today).toBeGreaterThan(week);
    expect(week).toBeGreaterThan(month);
    expect(month).toBeGreaterThan(quarter);
    expect(quarter).toBeGreaterThan(year);
    // Gentle: a week old is still worth most of what brand new is worth.
    expect(week / today).toBeGreaterThan(0.8);
    // And nothing ever falls off a cliff — one extra day is always a small step.
    for (let d = 0; d < 120; d++) {
      expect(recencyPoints(d) - recencyPoints(d + 1)).toBeLessThan(1);
    }
  });

  it("is never negative, so an old landmark is demoted but not punished", () => {
    for (const d of [0, 30, 365, 3650]) expect(recencyPoints(d)).toBeGreaterThanOrEqual(0);
  });

  it("gives an unknown date the benefit of an average one, not a penalty", () => {
    expect(recencyPoints(null)).toBeGreaterThan(0);
    expect(recencyPoints(null)).toBeLessThan(recencyPoints(0));
  });

  it("does not reward a paper dated in the future", () => {
    // PubMed really does publish "2026 Nov" in September (ahead of print).
    expect(recencyPoints(-40)).toBe(recencyPoints(0));
  });
});

describe("journalTier", () => {
  it("recognises the curated high-signal journals", () => {
    expect(journalTier("Nature")).toBeGreaterThan(0);
    expect(journalTier("Nature medicine")).toBeGreaterThan(0);
    expect(journalTier("The New England journal of medicine")).toBeGreaterThan(0);
    expect(journalTier("Journal of neural engineering")).toBeGreaterThan(0);
    expect(journalTier("Brain stimulation")).toBeGreaterThan(0);
  });

  it("ranks the general-science tier above the specialist tier", () => {
    expect(journalTier("Nature")).toBeGreaterThan(journalTier("Journal of neural engineering"));
  });

  it("is case- and punctuation-insensitive and ignores PubMed's parentheticals", () => {
    expect(journalTier("NATURE MEDICINE")).toBe(journalTier("Nature medicine"));
    expect(journalTier("Brain stimulation")).toBe(journalTier("Brain Stimulation."));
    expect(journalTier("Neurology (Basel, Switzerland)")).toBe(journalTier("Neurology"));
  });

  it("does not let a listed name match a different journal that merely contains it", () => {
    // The classic bug: "Nature" matching "Nature reviews. Urology".
    expect(journalTier("Nature reviews. Urology")).toBe(0);
    expect(journalTier("Brain stimulation and neuroplasticity quarterly")).toBe(0);
  });

  it("scores an unknown journal at zero rather than negative", () => {
    // The list is a stopgap, so absence from it must mean "no information",
    // not "bad". Most good papers are in journals nobody curated.
    expect(journalTier("Journal of Obscure Results")).toBe(0);
    expect(journalTier(null)).toBe(0);
  });
});

describe("titleScore", () => {
  it("penalises the shapes that mean 'this is not a paper'", () => {
    for (const t of [
      "A case of refractory epilepsy treated with DBS",
      "Comment on: deep brain stimulation for tremor",
      "Response to the letter by Smith et al",
      "Reply to Smith and colleagues",
      "Erratum: deep brain stimulation for tremor",
      "Correction to: vagus nerve stimulation outcomes",
      "Retraction notice to the above article",
      "Letter to the editor regarding spinal cord stimulation",
    ]) {
      expect(titleScore(t).points, t).toBeLessThan(0);
    }
  });

  it("leaves an ordinary title alone", () => {
    expect(titleScore("Deep brain stimulation for essential tremor: a randomised trial").points).toBe(0);
  });

  it("does not fire on a title that merely mentions a case somewhere inside it", () => {
    // "in the case of" is English, not a case report.
    expect(titleScore("Optimal lead placement in the case of asymmetric tremor").points).toBe(0);
  });

  it("rewards evidence that real humans were involved", () => {
    expect(titleScore("First-in-human chronic implantation of a speech neuroprosthesis").points).toBeGreaterThan(0);
    expect(titleScore("Restoring arm movement in people with tetraplegia").points).toBeGreaterThan(0);
    expect(titleScore("A decoder evaluated in patients with ALS").points).toBeGreaterThan(0);
  });

  it("rewards scale and genuine novelty cues", () => {
    expect(titleScore("Ultra high-density, 4096-channel intraoperative brain mapping").points).toBeGreaterThan(0);
    expect(titleScore("Chronic closed-loop stimulation over two years").points).toBeGreaterThan(0);
  });

  it("penalises the house style of incremental benchmark papers", () => {
    for (const t of [
      "TopoAdapter: a plug-and-play multi-hop topology adapter for MI-EEG decoding",
      "DSGF-Net: A Lightweight Dual-Stream Gated Fusion Network for Cross-Subject fNIRS Motor Task Classification",
      "Target-Session early stopping for cross-session EEG mental workload classification",
    ]) {
      expect(titleScore(t).points, t).toBeLessThan(0);
    }
  });

  it("does not mistake an ordinary subtitle colon for a coined model name", () => {
    expect(
      titleScore("Deep brain stimulation for Parkinson disease: a randomised controlled trial").points,
    ).toBe(0);
    expect(titleScore("Vision restoration: the NEUROPULSE trial").points).toBeGreaterThanOrEqual(0);
  });

  it("returns reasons a reader can understand", () => {
    expect(titleScore("First-in-human implantation in people with blindness").reasons.join(" ")).toMatch(
      /human/i,
    );
    expect(titleScore("Comment on: something").reasons.join(" ")).toMatch(/comment|reply|correction/i);
  });
});

describe("scorePaper", () => {
  it("is pure and deterministic — same input, same output, every time", () => {
    const p = corpus[0];
    const a = scorePaper(p, clinical);
    const b = scorePaper(p, clinical);
    expect(a).toEqual(b);
    expect(a.score).toBe(Math.trunc(a.score));
  });

  it("returns an integer, because topic_papers.score is an integer column", () => {
    for (const p of corpus) expect(Number.isInteger(scorePaper(p, clinical).score)).toBe(true);
  });

  it("always returns at least one reason, so the UI is never blank", () => {
    for (const p of corpus) expect(scorePaper(p, clinical).reasons.length).toBeGreaterThan(0);
  });

  it("weighs publication type heavily for a clinical topic", () => {
    const meta = paper({ pubTypes: ["Journal Article", "Meta-Analysis"] });
    const plain = paper({ pubTypes: ["Journal Article"] });
    expect(scorePaper(meta, clinical).score - scorePaper(plain, clinical).score).toBeGreaterThan(30);
  });

  it("weighs publication type much more lightly for an engineering topic", () => {
    const meta = paper({ pubTypes: ["Journal Article", "Meta-Analysis"] });
    const plain = paper({ pubTypes: ["Journal Article"] });
    const clinicalGap = scorePaper(meta, clinical).score - scorePaper(plain, clinical).score;
    const engineeringGap = scorePaper(meta, engineering).score - scorePaper(plain, engineering).score;
    expect(engineeringGap).toBeLessThan(clinicalGap);
    expect(engineeringGap).toBeGreaterThan(0);
    expect(WEIGHTS.pubTypeWeight.engineering).toBeLessThan(WEIGHTS.pubTypeWeight.clinical);
  });

  it("defaults to the clinical weighting when a topic does not say", () => {
    const p = paper({ pubTypes: ["Journal Article", "Meta-Analysis"] });
    expect(scorePaper(p, { now: NOW }).score).toBe(scorePaper(p, clinical).score);
  });

  it("prefers the newer of two otherwise identical papers", () => {
    const older = paper({ pmid: "1", publishedOn: "2026-06-01" });
    const newer = paper({ pmid: "2", publishedOn: "2026-09-20" });
    expect(scorePaper(newer, clinical).score).toBeGreaterThan(scorePaper(older, clinical).score);
  });

  it("cannot be rescued by recency alone: a fresh case report loses to an older RCT", () => {
    const freshCase = paper({
      pmid: "1",
      publishedOn: "2026-09-21",
      pubTypes: ["Journal Article", "Case Reports"],
      title: "A case of tremor",
    });
    const oldRct = paper({
      pmid: "2",
      publishedOn: "2026-03-01",
      pubTypes: ["Journal Article", "Randomized Controlled Trial"],
    });
    expect(scorePaper(oldRct, clinical).score).toBeGreaterThan(scorePaper(freshCase, clinical).score);
  });
});

describe("qualityScore (what the iPhone widget is actually sent)", () => {
  it("is in 0...1, because the Swift client clamps to that range", () => {
    for (const p of corpus) {
      const q = qualityScore(p);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
  });

  it("excludes recency, so the phone cannot double-count it", () => {
    // ios/Shared/FeedRanking.swift blends its own recency term at weight 0.35
    // with a 3-day half-life. Two identical papers published months apart must
    // therefore get the SAME quality score from the server.
    const older = paper({ pmid: "1", publishedOn: "2024-01-01" });
    const newer = paper({ pmid: "2", publishedOn: "2026-09-20" });
    expect(qualityScore(newer)).toBe(qualityScore(older));
    // ...even though the server's own ordering score does differ.
    expect(scorePaper(newer, clinical).score).toBeGreaterThan(scorePaper(older, clinical).score);
  });

  it("puts a meta-analysis near the top of the range and a case report near the bottom", () => {
    const meta = qualityScore(paper({ pubTypes: ["Journal Article", "Meta-Analysis"], journal: "Nature" }));
    const ordinary = qualityScore(paper());
    const caseReport = qualityScore(paper({ pubTypes: ["Journal Article", "Case Reports"] }));
    expect(meta).toBeGreaterThan(0.9);
    expect(ordinary).toBeGreaterThan(0.3);
    expect(ordinary).toBeLessThan(0.6);
    expect(caseReport).toBeLessThan(0.25);
  });

  it("clamps rather than going negative for a retraction", () => {
    expect(qualityScore(paper({ pubTypes: ["Retracted Publication"], title: "Retraction of everything" }))).toBe(0);
  });
});

describe("rankPapers, on the 39 real recorded papers", () => {
  const ranked = rankPapers(corpus, clinical);

  it("ranks every paper and keeps them all", () => {
    expect(ranked).toHaveLength(corpus.length);
    expect(new Set(ranked.map((p) => p.pmid)).size).toBe(corpus.length);
  });

  it("sorts strictly by descending score", () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("is a stable, deterministic order even when scores tie", () => {
    const again = rankPapers([...corpus].reverse(), clinical);
    expect(again.map((p) => p.pmid)).toEqual(ranked.map((p) => p.pmid));
  });

  it("puts every meta-analysis, systematic review and RCT above every case report", () => {
    const highest = (types: string[]) =>
      Math.min(
        ...ranked
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => types.some((t) => p.pubTypes.includes(t)))
          .map(({ i }) => i),
      );
    const worst = (types: string[]) =>
      Math.max(
        ...ranked
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => types.some((t) => p.pubTypes.includes(t)))
          .map(({ i }) => i),
      );
    const evidenceWorst = worst(["Meta-Analysis", "Systematic Review", "Randomized Controlled Trial"]);
    const noiseBest = highest(["Case Reports", "Editorial", "Comment", "Letter"]);
    expect(evidenceWorst).toBeLessThan(noiseBest);
  });

  it("puts no case report, editorial or letter in the top ten", () => {
    // The widget shows three. The top ten is a generous margin.
    for (const p of ranked.slice(0, 10)) {
      for (const bad of ["Case Reports", "Editorial", "Comment", "Letter"]) {
        expect(p.pubTypes, `${p.pmid} ${p.title}`).not.toContain(bad);
      }
    }
  });

  it("fills the top three with high-tier evidence", () => {
    for (const p of ranked.slice(0, 3)) {
      const good = ["Meta-Analysis", "Systematic Review", "Randomized Controlled Trial", "Practice Guideline"];
      expect(good.some((t) => p.pubTypes.includes(t)), p.title).toBe(true);
    }
  });

  it("gives every ranked paper reasons the UI can render as tags", () => {
    for (const p of ranked) {
      expect(p.reasons.length).toBeGreaterThan(0);
      for (const r of p.reasons) {
        expect(typeof r).toBe("string");
        expect(r.length).toBeGreaterThan(0);
        expect(r.length).toBeLessThan(40); // it has to fit in a small tag
      }
    }
  });
});

/**
 * THE REGRESSION TEST THAT MATTERS MOST.
 *
 * These four titles are real, from PubMed's brain-computer-interfaces slice of
 * the last fortnight (docs/eval/eval-set.csv). NONE of them carries a
 * publication type, so a pub-type-only ranker cannot tell them apart at all.
 * Two are landmarks; two are incremental benchmark papers. If Sift cannot
 * separate them it does not work for Kalp's main field.
 */
describe("engineering topics: the BCI landmark regression", () => {
  const landmarks = [
    paper({
      pmid: "42735699",
      title:
        "Ultra high-density, 4096-channel intraoperative neurophysiological brain mapping for functional localization",
      journal: "Journal of neural engineering",
      publishedOn: "2026-09-14",
      pubTypes: [],
    }),
    paper({
      pmid: "42733633",
      title:
        "Vision Restoration to People with Long-Term Blindness Using the Brain-Computer Interface Technology",
      journal: "Patient preference and adherence",
      publishedOn: "2026-09-01",
      pubTypes: [],
    }),
  ];
  const incremental = [
    paper({
      pmid: "42759576",
      title: "TopoAdapter: a plug-and-play multi-hop topology adapter for MI-EEG decoding",
      journal: "Journal of neuroscience methods",
      publishedOn: "2026-09-18",
      pubTypes: [],
    }),
    paper({
      pmid: "42732314",
      title:
        "Target-Session early stopping for cross-session EEG mental workload classification: a reusable recipe",
      journal: "MethodsX",
      publishedOn: "2026-12-01",
      pubTypes: [],
    }),
  ];

  it("ranks both landmarks above both incremental papers", () => {
    const order = rankPapers([...incremental, ...landmarks], engineering).map((p) => p.pmid);
    expect(order.slice(0, 2).sort()).toEqual(["42733633", "42735699"]);
  });

  it("does it on title signal alone, since none of the four has a publication type", () => {
    for (const p of [...landmarks, ...incremental]) expect(p.pubTypes).toEqual([]);
  });

  it("explains the landmarks in words a reader would accept", () => {
    const reasons = landmarks.map((p) => scorePaper(p, engineering).reasons.join(" ").toLowerCase());
    expect(reasons[0]).toMatch(/channel|high-density|journal of neural engineering/);
    expect(reasons[1]).toMatch(/human|people|restoration/);
  });

  it("is not saved by recency — the newest of the four is an incremental paper", () => {
    // Its PubMed date is "2026 Dec", i.e. ahead of print, so it gets the full
    // recency bonus and still loses. That is the point: recency alone must
    // never be enough to reach the top of a feed this short.
    const newest = [...landmarks, ...incremental].sort((a, b) =>
      (b.publishedOn ?? "").localeCompare(a.publishedOn ?? ""),
    )[0];
    expect(newest.pmid).toBe("42732314");
    const order = rankPapers([...incremental, ...landmarks], engineering).map((p) => p.pmid);
    expect(order.indexOf("42732314")).toBeGreaterThan(1);
  });
});
