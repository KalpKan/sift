import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PaperEntry, { formatDate } from "./PaperEntry";
import type { FeedPaper } from "@/lib/feed";

function paper(over: Partial<FeedPaper> = {}): FeedPaper {
  return {
    id: "42751933",
    pmid: "42751933",
    title: "Cognitive behavioural therapy for insomnia: a systematic review",
    journal: "Brain stimulation",
    authorsShort: "Zhang et al.",
    published: "2026-09-14T00:00:00Z",
    doi: "10.1177/03000605261487272",
    url: "https://doi.org/10.1177/03000605261487272",
    score: 0.87,
    orderScore: 88,
    summary: null,
    reasons: ["4 days old", "meta-analysis", "key journal in field"],
    ...over,
  };
}

const html = (over: Partial<FeedPaper> = {}, rank = 1) =>
  renderToStaticMarkup(<PaperEntry paper={paper(over)} rank={rank} topic="neuromodulation" />);

describe("formatDate", () => {
  it("formats in UTC, independently of the server's locale", () => {
    expect(formatDate("2026-09-14T00:00:00Z")).toBe("14 Sep 2026");
    expect(formatDate("2026-01-01T00:00:00Z")).toBe("1 Jan 2026");
    expect(formatDate("2026-12-31T23:59:00Z")).toBe("31 Dec 2026");
  });

  it("returns an empty string for junk rather than 'Invalid Date'", () => {
    expect(formatDate("not a date")).toBe("");
    expect(formatDate("")).toBe("");
  });
});

describe("PaperEntry", () => {
  it("makes the title the link, because the title is what you click", () => {
    const out = html();
    expect(out).toContain("Cognitive behavioural therapy for insomnia: a systematic review");
    expect(out).toMatch(/<a[^>]*href="https:\/\/doi\.org\/10\.1177\/03000605261487272"/);
  });

  it("falls back to the PubMed permalink when there is no DOI link", () => {
    expect(html({ url: null, doi: null })).toMatch(
      /href="https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/42751933\/"/,
    );
  });

  it("puts the byline, the journal and the date on one line", () => {
    expect(html()).toContain("Zhang et al. · Brain stimulation · 14 Sep 2026");
  });

  it("omits an empty journal or byline instead of printing a stray separator", () => {
    const out = html({ journal: "", authorsShort: "" });
    expect(out).toContain("14 Sep 2026");
    expect(out).not.toContain("· ·");
    expect(out).not.toMatch(/>\s*·/);
  });

  it("shows every reason the ranker gave", () => {
    const out = html();
    for (const r of ["4 days old", "meta-analysis", "key journal in field"]) {
      expect(out).toContain(r);
    }
  });

  it("renders nothing at all when there are no reasons, rather than an empty list", () => {
    expect(html({ reasons: [] })).not.toContain("<ul");
  });

  it("shows the ORDERING score, not the 0...1 quality the phone gets", () => {
    // The list is sorted by orderScore, so showing `score` would print a
    // column of numbers that do not descend.
    const out = html({ score: 0.874, orderScore: 91 });
    expect(out).toContain("91");
    expect(out).not.toContain("0.874");
  });

  it("opens papers in a new tab with a safe rel", () => {
    const out = html();
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noreferrer");
  });

  it("hides the rank number from assistive technology", () => {
    // It is a position in a list, which the document order already conveys.
    expect(html({}, 7)).toMatch(/aria-hidden="true"[^>]*>\s*7\s*</);
  });

  it("escapes a title containing markup", () => {
    expect(html({ title: "Effects of <script>alert(1)</script> on tremor" })).not.toContain("<script>");
  });
});
