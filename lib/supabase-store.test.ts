// @vitest-environment node
import { describe, expect, it } from "vitest";
import { paperToRow, rowToPaper, rowToStoredPaper, rowToTopic } from "./supabase-store";
import type { Paper } from "./pubmed";

describe("rowToTopic", () => {
  const row = {
    id: "id-1",
    slug: "neuromodulation",
    name: "Neuromodulation",
    pubmed_query: '"deep brain stimulation"[MeSH Terms]',
    description: "d",
    kind: "clinical",
    source: "pubmed",
    is_active: true,
  };

  it("renames snake_case columns to the app's camelCase type", () => {
    expect(rowToTopic(row)).toEqual({
      id: "id-1",
      slug: "neuromodulation",
      name: "Neuromodulation",
      pubmedQuery: '"deep brain stimulation"[MeSH Terms]',
      description: "d",
      kind: "clinical",
      source: "pubmed",
      isActive: true,
    });
  });

  it("keeps an engineering topic engineering", () => {
    expect(rowToTopic({ ...row, kind: "engineering" }).kind).toBe("engineering");
  });

  it("falls back to clinical for an unrecognised kind instead of throwing", () => {
    // A bad label in one row must not take down the whole feed.
    expect(rowToTopic({ ...row, kind: "nonsense" }).kind).toBe("clinical");
  });
});

describe("paperToRow / rowToPaper", () => {
  const paper: Paper = {
    pmid: "42751933",
    title: "A systematic review of something",
    journal: "Brain stimulation",
    authors: ["Zhang C", "Yang L"],
    doi: "10.1000/x",
    url: "https://doi.org/10.1000/x",
    publishedOn: "2026-09-01",
    datePrecision: "month",
    pubTypes: ["Journal Article", "Meta-Analysis"],
    raw: { uid: "42751933" },
  };

  it("round-trips the fields the ranker and the UI need", () => {
    const back = rowToPaper(paperToRow(paper));
    expect(back).toMatchObject({
      pmid: paper.pmid,
      title: paper.title,
      journal: paper.journal,
      authors: paper.authors,
      doi: paper.doi,
      url: paper.url,
      publishedOn: paper.publishedOn,
      pubTypes: paper.pubTypes,
    });
  });

  it("writes the columns migration 0002 actually declares", () => {
    expect(Object.keys(paperToRow(paper)).sort()).toEqual(
      ["authors", "doi", "journal", "pmid", "pub_types", "published_on", "raw", "title", "url"].sort(),
    );
  });

  it("turns null array columns into empty arrays, never null", () => {
    const p = rowToPaper({
      pmid: "1",
      title: "T",
      journal: null,
      authors: null,
      doi: null,
      url: null,
      published_on: null,
      pub_types: null,
    });
    expect(p.authors).toEqual([]);
    expect(p.pubTypes).toEqual([]);
  });

  it("rebuilds a PubMed permalink when the stored url is missing", () => {
    const p = rowToPaper({
      pmid: "999",
      title: "T",
      journal: null,
      authors: null,
      doi: null,
      url: null,
      published_on: null,
      pub_types: null,
    });
    expect(p.url).toBe("https://pubmed.ncbi.nlm.nih.gov/999/");
  });
});

describe("rowToStoredPaper", () => {
  const base = {
    pmid: "1",
    score: 88,
    score_reasons: ["meta-analysis", "3 days old"],
    ranked_at: "2026-09-21T00:00:00Z",
    papers: {
      pmid: "1",
      title: "T",
      journal: "Brain",
      authors: ["A B"],
      doi: null,
      url: null,
      published_on: "2026-09-18",
      pub_types: ["Journal Article"],
      first_seen_at: "2026-09-19T00:00:00Z",
    },
  };

  it("joins the score onto the paper", () => {
    const s = rowToStoredPaper(base)!;
    expect(s.score).toBe(88);
    expect(s.reasons).toEqual(["meta-analysis", "3 days old"]);
    expect(s.rankedAt).toBe("2026-09-21T00:00:00Z");
    expect(s.firstSeenAt).toBe("2026-09-19T00:00:00Z");
    expect(s.title).toBe("T");
  });

  it("drops a row whose paper failed to join, rather than rendering a blank", () => {
    expect(rowToStoredPaper({ ...base, papers: null })).toBeNull();
  });

  it("survives a score_reasons column holding anything at all", () => {
    // It is jsonb. Defensive coercion here is cheaper than a broken page.
    for (const junk of [null, "oops", 42, { a: 1 }]) {
      expect(rowToStoredPaper({ ...base, score_reasons: junk })!.reasons).toEqual([]);
    }
    expect(rowToStoredPaper({ ...base, score_reasons: ["ok", 7, null] })!.reasons).toEqual(["ok"]);
  });
});
