import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MONTHS,
  createPubMedClient,
  esearchUrl,
  esummaryUrl,
  parseSearchResponse,
  parseSummaries,
  parseSummary,
  parsePubDate,
  pubmedUrl,
  type Paper,
} from "./pubmed";

const fixtureDir = path.resolve(__dirname, "..", "tests", "fixtures", "pubmed");
const fixture = (name: string) => JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8"));

/** Recorded live on 2026-09-21 by scripts/capture-fixtures.mjs. No test touches the network. */
const recent = fixture("esearch-neuromodulation-7d.json");
const empty = fixture("esearch-empty.json");
const small = fixture("esummary-small.json");
const corpus = fixture("esummary-corpus.json");

describe("parsePubDate", () => {
  // Every one of these shapes is present in the recorded corpus except where
  // noted; PubMed has no schema for this field, so the parser must never throw.
  it.each([
    ["2026 Sep 14", "2026-09-14", "day"],
    ["2026 Sep 1", "2026-09-01", "day"],
    ["2026 Aug 29", "2026-08-29", "day"],
    ["2026 Jul 9", "2026-07-09", "day"],
    ["2026 Sep", "2026-09-01", "month"],
    ["2026 Nov", "2026-11-01", "month"],
    ["2025 May", "2025-05-01", "month"],
    ["2026", "2026-01-01", "year"],
  ])("parses %s", (input, date, precision) => {
    expect(parsePubDate(input)).toEqual({ date, precision });
  });

  it("takes the FIRST month of a range, never the last", () => {
    // "2026 Sep-Oct" is one issue covering two months. The honest normalisation
    // is the start of the period; taking October would make the paper look
    // newer than PubMed itself claims.
    expect(parsePubDate("2026 Sep-Oct")).toEqual({ date: "2026-09-01", precision: "month" });
    expect(parsePubDate("2026 Jul-Aug")).toEqual({ date: "2026-07-01", precision: "month" });
  });

  it("maps NLM season names to the first month of the quarter", () => {
    expect(parsePubDate("2026 Winter")).toEqual({ date: "2026-01-01", precision: "month" });
    expect(parsePubDate("2026 Spring")).toEqual({ date: "2026-04-01", precision: "month" });
    expect(parsePubDate("2026 Summer")).toEqual({ date: "2026-07-01", precision: "month" });
    expect(parsePubDate("2026 Fall")).toEqual({ date: "2026-10-01", precision: "month" });
    expect(parsePubDate("2026 Autumn")).toEqual({ date: "2026-10-01", precision: "month" });
  });

  it("handles a date range that crosses a year boundary", () => {
    expect(parsePubDate("2026 Dec 31-2027 Jan 1")).toEqual({ date: "2026-12-31", precision: "day" });
  });

  it("tolerates the sortpubdate format (slashes and a clock time)", () => {
    expect(parsePubDate("2026/09/01 00:00")).toEqual({ date: "2026-09-01", precision: "day" });
  });

  it("returns nothing rather than guessing, for junk and for empty input", () => {
    for (const junk of ["", "   ", "n/a", "no date", "Sep", "20xx Sep"]) {
      expect(parsePubDate(junk)).toEqual({ date: null, precision: "none" });
    }
  });

  it("clamps an impossible day instead of rolling into the next month", () => {
    // JS Date would turn 2026-02-31 into March 3rd. Silently moving a paper to
    // a different month is worse than losing a day of precision.
    expect(parsePubDate("2026 Feb 31")).toEqual({ date: "2026-02-01", precision: "month" });
  });

  it("knows all twelve month abbreviations", () => {
    expect(Object.keys(MONTHS)).toHaveLength(12);
    expect(parsePubDate("2026 Jan 5").date).toBe("2026-01-05");
    expect(parsePubDate("2026 Dec 5").date).toBe("2026-12-05");
  });

  it("is case-insensitive, because PubMed is not consistent", () => {
    expect(parsePubDate("2026 SEP 14").date).toBe("2026-09-14");
    expect(parsePubDate("2026 september 14").date).toBe("2026-09-14");
  });

  it("parses every pubdate value in the recorded corpus", () => {
    const values: string[] = corpus.result.uids.map((u: string) => corpus.result[u].pubdate);
    expect(values.length).toBeGreaterThan(30);
    for (const v of values) {
      expect(parsePubDate(v).date, v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("parseSearchResponse", () => {
  it("reads the PMID list and the true total, which is much larger than the page", () => {
    const r = parseSearchResponse(recent);
    expect(r.pmids).toHaveLength(20);
    expect(r.pmids[0]).toBe("42764133");
    // The whole reason Sift exists: one week, one query, 280 papers.
    expect(r.total).toBe(280);
    expect(r.total).toBeGreaterThan(r.pmids.length);
  });

  it("returns an empty result, not an error, when PubMed finds nothing", () => {
    expect(parseSearchResponse(empty)).toEqual({ pmids: [], total: 0 });
  });

  it("survives a malformed or truncated body", () => {
    for (const bad of [null, {}, { esearchresult: {} }, { esearchresult: { idlist: null } }]) {
      expect(parseSearchResponse(bad)).toEqual({ pmids: [], total: 0 });
    }
  });

  it("drops anything in idlist that is not a PMID", () => {
    const r = parseSearchResponse({ esearchresult: { count: "3", idlist: ["123", "", null, "abc", "456"] } });
    expect(r.pmids).toEqual(["123", "456"]);
  });
});

describe("parseSummary", () => {
  const byPmid = new Map<string, Paper>(
    parseSummaries(corpus).map((p) => [p.pmid, p] as const),
  );

  it("parses a plain systematic review end to end", () => {
    const p = byPmid.get("42751933")!;
    expect(p).toBeDefined();
    expect(p.title).toBe(
      "Cognitive behavioral therapy for insomnia-assisted discontinuation or reduction of benzodiazepine receptor agonists and Z-drugs in chronic insomnia: A systematic review and meta-analysis",
    );
    expect(p.journal).toBe("The Journal of international medical research");
    expect(p.authors).toEqual(["Zhang C", "Yang L", "Zhang J"]);
    expect(p.doi).toBe("10.1177/03000605261487272");
    expect(p.publishedOn).toBe("2026-09-01");
    expect(p.pubTypes).toContain("Meta-Analysis");
    expect(p.url).toBe("https://doi.org/10.1177/03000605261487272");
  });

  it("strips the trailing full stop PubMed puts on every title", () => {
    for (const p of byPmid.values()) {
      expect(p.title.endsWith("."), p.pmid).toBe(false);
      expect(p.title.length).toBeGreaterThan(0);
    }
  });

  it("unwraps the square brackets around a translated (non-English) title", () => {
    // PubMed renders a translated title as "[Real title]." — the brackets are
    // notation, not part of the title, and they look like a bug in a widget.
    const p = byPmid.get("42742564")!;
    expect(p.title).toBe(
      "Evaluation of tolerability and cognitive safety of trospium chloride in the treatment of overactive bladder: a systematic review and meta-analysis",
    );
    expect(p.title.startsWith("[")).toBe(false);
  });

  it("keeps a collective (study-group) author rather than dropping it", () => {
    const p = byPmid.get("42233958")!;
    expect(p.authors).toContain("Nautilus Study Group");
  });

  it("falls back to the PubMed permalink when a paper has no DOI", () => {
    const p = byPmid.get("40518906")!;
    expect(p.doi).toBeNull();
    expect(p.url).toBe("https://pubmed.ncbi.nlm.nih.gov/40518906/");
  });

  it("keeps the raw record so a better ranker can be back-filled later", () => {
    const p = byPmid.get("42751933")!;
    expect(p.raw).toMatchObject({ uid: "42751933", sortpubdate: expect.any(String) });
  });

  it("parses every record in the corpus into a usable paper", () => {
    expect(byPmid.size).toBe(corpus.result.uids.length);
    for (const p of byPmid.values()) {
      expect(p.pmid).toMatch(/^\d+$/);
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(p.pubTypes)).toBe(true);
      expect(p.url.startsWith("https://")).toBe(true);
    }
  });

  it("parses the small three-record response too", () => {
    const papers = parseSummaries(small);
    expect(papers.length).toBe(small.result.uids.length);
    expect(papers.length).toBeGreaterThan(0);
  });

  it("falls back to sortpubdate when pubdate is unparseable", () => {
    const p = parseSummary({ uid: "1", title: "T.", pubdate: "n/a", sortpubdate: "2026/03/04 00:00" });
    expect(p?.publishedOn).toBe("2026-03-04");
  });

  it("returns null for a record with no uid or no title, instead of a broken row", () => {
    expect(parseSummary({ title: "No uid." })).toBeNull();
    expect(parseSummary({ uid: "1" })).toBeNull();
    expect(parseSummary({ uid: "1", title: "   " })).toBeNull();
    expect(parseSummary(null)).toBeNull();
  });

  it("skips the `uids` key and any per-record error PubMed returns", () => {
    const papers = parseSummaries({
      result: {
        uids: ["1", "2"],
        "1": { uid: "1", title: "Good one.", pubdate: "2026 Sep" },
        "2": { uid: "2", error: "cannot get document summary" },
      },
    });
    expect(papers.map((p) => p.pmid)).toEqual(["1"]);
  });

  it("returns [] for a malformed body", () => {
    for (const bad of [null, {}, { result: null }, { result: { uids: null } }]) {
      expect(parseSummaries(bad)).toEqual([]);
    }
  });

  it("prefers fulljournalname but falls back to the abbreviation", () => {
    const p = parseSummary({ uid: "1", title: "T.", source: "Brain Stimul", pubdate: "2026" });
    expect(p?.journal).toBe("Brain Stimul");
  });
});

describe("url builders", () => {
  it("builds a PubMed permalink", () => {
    expect(pubmedUrl("42764133")).toBe("https://pubmed.ncbi.nlm.nih.gov/42764133/");
  });

  it("builds an esearch URL with the verified parameters", () => {
    const u = new URL(esearchUrl("neuromodulation", 7, 5));
    expect(u.origin + u.pathname).toBe("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    expect(u.searchParams.get("db")).toBe("pubmed");
    expect(u.searchParams.get("term")).toBe("neuromodulation");
    expect(u.searchParams.get("sort")).toBe("date");
    expect(u.searchParams.get("retmode")).toBe("json");
    // `edat` = Entrez date, i.e. when PubMed got it. That is "new to the
    // reader", which is the question the widget answers; `pdat` would miss a
    // paper indexed late and show one indexed early twice.
    expect(u.searchParams.get("datetype")).toBe("edat");
    expect(u.searchParams.get("reldate")).toBe("7");
    expect(u.searchParams.get("retmax")).toBe("5");
    // NCBI asks unauthenticated callers to identify themselves.
    expect(u.searchParams.get("tool")).toBeTruthy();
  });

  it("builds an esummary URL with comma-joined ids", () => {
    const u = new URL(esummaryUrl(["1", "2", "3"]));
    expect(u.pathname.endsWith("esummary.fcgi")).toBe(true);
    expect(u.searchParams.get("id")).toBe("1,2,3");
    expect(u.searchParams.get("retmode")).toBe("json");
  });
});

/** A fetch stand-in that records URLs and never touches the network. */
function stubFetch(bodyFor: (url: string) => unknown) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify(bodyFor(url)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { calls, fn: fn as unknown as typeof fetch };
}

describe("createPubMedClient", () => {
  function client(bodyFor: (url: string) => unknown, spacingMs: number | undefined = 400) {
    const { calls, fn } = stubFetch(bodyFor);
    let t = 0;
    // The fake clock only advances when the client sleeps, so a client that
    // forgets to throttle cannot accidentally pass these tests.
    const sleep = vi.fn(async (ms: number) => {
      t += ms;
    });
    const c = createPubMedClient({ fetchImpl: fn, sleep, now: () => t, spacingMs });
    return { c, calls, sleep, advance: (ms: number) => (t += ms) };
  }

  it("searchRecent returns the parsed result", async () => {
    const { c, calls } = client(() => recent);
    const r = await c.searchRecent("neuromodulation", 7, 20);
    expect(r.total).toBe(280);
    expect(r.pmids).toHaveLength(20);
    expect(calls[0]).toContain("esearch.fcgi");
  });

  it("caps retmax so a bad caller cannot ask NCBI for the whole database", async () => {
    const { c, calls } = client(() => recent);
    await c.searchRecent("neuromodulation", 7, 100000);
    expect(Number(new URL(calls[0]).searchParams.get("retmax"))).toBeLessThanOrEqual(200);
  });

  it("fetchSummaries returns papers", async () => {
    const { c, calls } = client(() => small);
    const papers = await c.fetchSummaries(small.result.uids);
    expect(papers).toHaveLength(small.result.uids.length);
    expect(calls[0]).toContain("esummary.fcgi");
  });

  it("fetchSummaries makes no request at all for an empty id list", async () => {
    const { c, calls } = client(() => small);
    expect(await c.fetchSummaries([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("batches large id lists instead of building a giant URL", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => String(1000 + i));
    const { c, calls } = client((url) => {
      const got = new URL(url).searchParams.get("id")!.split(",");
      const result: Record<string, unknown> = { uids: got };
      for (const id of got) result[id] = { uid: id, title: `Paper ${id}.`, pubdate: "2026 Sep" };
      return { result };
    });
    const papers = await c.fetchSummaries(ids);
    expect(papers).toHaveLength(450);
    expect(calls.length).toBeGreaterThan(1);
    for (const url of calls) {
      expect(new URL(url).searchParams.get("id")!.split(",").length).toBeLessThanOrEqual(200);
    }
  });

  it("deduplicates ids before asking NCBI", async () => {
    const { c, calls } = client(() => small);
    await c.fetchSummaries(["7", "7", "8", "7"]);
    expect(new URL(calls[0]).searchParams.get("id")).toBe("7,8");
  });

  it("serialises calls and spaces them, to respect NCBI's 3 requests/second", async () => {
    const { c, sleep } = client(() => recent);
    await c.searchRecent("a", 7, 5);
    await c.searchRecent("b", 7, 5);
    await c.searchRecent("c", 7, 5);
    // Two waits: the first call is free, each later call waits out the gap.
    expect(sleep).toHaveBeenCalledTimes(2);
    for (const [ms] of sleep.mock.calls) expect(ms).toBe(400);
  });

  it("does not sleep when enough real time has already passed", async () => {
    const { c, sleep, advance } = client(() => recent);
    await c.searchRecent("a", 7, 5);
    advance(5000);
    await c.searchRecent("b", 7, 5);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("defaults to a spacing under NCBI's limit of 3 requests per second", async () => {
    // `undefined` spacing means "use the module default", which is the value
    // that will actually be in force in production.
    const { c, sleep } = client(() => recent, undefined);
    await c.searchRecent("a", 7, 5);
    await c.searchRecent("b", 7, 5);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThanOrEqual(1000 / 3);
  });

  it("throws a useful error on an HTTP failure", async () => {
    const fn = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const c = createPubMedClient({ fetchImpl: fn, sleep: async () => {}, now: () => 0 });
    await expect(c.searchRecent("x", 7, 5)).rejects.toThrow(/429/);
  });

  it("throws on a non-JSON body rather than returning a silently empty feed", async () => {
    const fn = vi.fn(
      async () => new Response("<html>NCBI is down</html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const c = createPubMedClient({ fetchImpl: fn, sleep: async () => {}, now: () => 0 });
    await expect(c.searchRecent("x", 7, 5)).rejects.toThrow();
  });
});
