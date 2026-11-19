import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PaperEntry, { formatDate, reasonText } from "./PaperEntry";
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

const html = (over: Partial<FeedPaper> = {}, rank = 1, extra: { hue?: number; isNew?: boolean } = {}) =>
  renderToStaticMarkup(<PaperEntry paper={paper(over)} rank={rank} topic="neuromodulation" {...extra} />);

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
    expect(html()).toContain("Zhang et al.\u00A0· Brain stimulation\u00A0· <span class=\"whitespace-nowrap\">14 Sep 2026</span>");
  });

  it("keeps the date in one nowrap run and every separator with the item before it, never starting a line", () => {
    const out = html();
    expect(out).toContain('<span class="whitespace-nowrap">14 Sep 2026</span>');
    // Every " · " is a non-breaking space then the dot; a plain space follows it, so a line may end with a dot.
    expect(out).not.toMatch(/[^\u00A0] ·/);
    expect(out.match(/\u00A0·/g)).toHaveLength(2);
  });

  it("puts the score at the right end of the first reasons line on a phone, and keeps a line for a row with no reasons", () => {
    const withReasons = html();
    expect(withReasons.indexOf(">88<")).toBeLessThan(withReasons.indexOf("4 days old"));
    expect(withReasons).toMatch(/class="[^"]*float-right[^"]*">88</);
    const bare = html({ reasons: [] });
    expect(bare).not.toContain("float-right");
    expect(bare).toMatch(/class="[^"]*mt-2\.5[^"]*">88</);
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

  it("says `new` as the first reason, in words, when the paper is new", () => {
    const out = html({}, 1, { isNew: true });
    expect(out).toMatch(/<ul[^>]*><li[^>]*>new<\/li><li[^>]*>4 days old<\/li>/);
    expect(html()).not.toMatch(/>new</);
  });

  it("rings the dot for a new paper and colours it by the topic's hue", () => {
    expect(html({}, 1, { isNew: true, hue: 2 })).toContain("--c:var(--cluster-3)");
    expect(html({}, 1, { isNew: true })).toContain("var(--spike)");
    expect(html()).not.toContain("var(--spike)");
  });

  it("wraps a 220-character title inside its column", () => {
    expect(html({ title: "x".repeat(220) })).toContain("overflow-wrap:anywhere");
  });

  it("carries no rating controls", () => {
    const out = html();
    expect(out).not.toContain("<button");
    expect(out).not.toContain("👍");
  });
});

describe("reasonText (display-only singular repair)", () => {
  it("shows 1 weeks / days / months old in the singular", () => {
    expect(reasonText("1 weeks old")).toBe("1 week old");
    expect(reasonText("1 days old")).toBe("1 day old");
    expect(reasonText("1 months old")).toBe("1 month old");
  });
  it("leaves every other reason alone, including 11 weeks, 21 days and 2 months", () => {
    for (const r of ["11 weeks old", "21 days old", "2 months old", "4 days old", "1 years old", "meta-analysis", "published today", "brain-computer interface"]) {
      expect(reasonText(r)).toBe(r);
    }
  });
  it("is applied in the row, and drops nothing", () => {
    const html = renderToStaticMarkup(<PaperEntry paper={paper({ reasons: ["1 weeks old", "meta-analysis"] })} rank={1} topic="neuromodulation" />);
    expect(html).toContain("1 week old");
    expect(html).not.toContain("1 weeks old");
    expect(html).toContain("meta-analysis");
  });
});
