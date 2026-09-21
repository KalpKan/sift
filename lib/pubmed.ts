/**
 * A small typed client for NCBI's E-utilities, which is how Sift gets papers.
 *
 * Why this source: it is free, needs no API key, no registration and no
 * billing relationship, and it is the canonical index for biomedicine. That
 * matters more than it sounds — Sift must cost $0 forever, and every paid
 * alternative would put a subscription between Kalp and his own reading list.
 *
 * TWO RULES THIS MODULE EXISTS TO ENFORCE:
 *
 * 1. NCBI allows 3 requests per second without an API key, and answers HTTP
 *    429 above it. Every call from a client instance goes through one
 *    serialising gate (`throttle` below), so concurrent callers queue rather
 *    than burst. Do not add a code path that calls `fetch` directly.
 *
 * 2. Nothing here may be imported into a test that then hits the network.
 *    `fetchImpl` is injectable for exactly that reason; the unit tests run
 *    against JSON recorded by scripts/capture-fixtures.mjs.
 *
 * The parsing half of the module is pure and exported separately from the
 * fetching half, which is what makes the fixture tests possible.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/** NCBI asks unauthenticated callers to identify themselves in every request. */
const TOOL = "sift-kalpkan";

/** NCBI's documented ceiling without an API key is 3 req/s; 400 ms leaves margin. */
const DEFAULT_SPACING_MS = 400;

/** esummary takes a comma-joined id list; NCBI suggests POST above ~200 ids. */
export const MAX_IDS_PER_REQUEST = 200;

/** Never ask for more than this in one esearch page, whatever a caller passes. */
export const MAX_RETMAX = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One paper, cleaned up. This is the shape the rest of the app knows about. */
export type Paper = {
  pmid: string;
  /** Trailing full stop removed, translated-title brackets unwrapped. */
  title: string;
  journal: string | null;
  authors: string[];
  doi: string | null;
  /** Where to send a reader: doi.org when there is a DOI, else the PubMed record. */
  url: string;
  /** ISO `YYYY-MM-DD`, normalised to the start of the period. Null if unparseable. */
  publishedOn: string | null;
  /** How much of `publishedOn` PubMed actually asserted. */
  datePrecision: DatePrecision;
  /** e.g. ["Journal Article", "Meta-Analysis"]. The strongest free ranking signal. */
  pubTypes: string[];
  /** The untouched esummary record, stored so a better ranker can be back-filled. */
  raw: unknown;
};

export type DatePrecision = "day" | "month" | "year" | "none";

export type SearchResult = { pmids: string[]; total: number };

/**
 * THE SEAM for a second source. arXiv is free and key-less too, and for
 * brain-computer interfaces and neural engineering it carries the interesting
 * work months before PubMed indexes it. v1 implements PubMed only; adding
 * arXiv should be a new file implementing this interface plus a row in
 * `sift.topics` with `source = 'arxiv'`, not a refactor of anything here.
 */
export interface SourceClient {
  searchRecent(query: string, days: number, limit: number): Promise<SearchResult>;
  fetchSummaries(ids: string[]): Promise<Paper[]>;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

export const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * NLM prints seasons instead of months for some quarterlies. Mapping each to
 * the first month of its quarter is the conventional reading and keeps the
 * ordering right; it is a convention, not a fact PubMed asserted.
 */
const SEASONS: Record<string, number> = { winter: 1, spring: 4, summer: 7, fall: 10, autumn: 10 };

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * PubMed's `pubdate` has no schema. The corpus in tests/fixtures alone
 * contains "2026 Sep 14", "2026 Sep", "2026", "2026 Sep-Oct" and
 * "2026 Jul-Aug"; PubMed at large also emits seasons and cross-year ranges.
 *
 * Rules, all of them chosen to under-claim rather than over-claim:
 *   - a range resolves to its START ("2026 Sep-Oct" is a September issue)
 *   - a missing day or month becomes the 1st / January, and `precision` says so
 *   - an impossible day (PubMed does emit these) degrades to month precision
 *     rather than letting Date roll it into the following month
 *   - junk returns null; the caller must not be handed a guessed date
 */
export function parsePubDate(value: unknown): { date: string | null; precision: DatePrecision } {
  const none = { date: null, precision: "none" as const };
  if (typeof value !== "string") return none;
  // A range: keep only the part before the dash, but not a dash inside a
  // month-range like "Sep-Oct", which the token scan below handles anyway.
  const text = value.trim().toLowerCase();
  if (!text) return none;

  const year = /^(\d{4})\b/.exec(text);
  if (!year) return none;
  const y = Number(year[1]);

  // Everything after the year, e.g. "sep 14", "sep-oct", "winter", "/09/01 00:00".
  const rest = text.slice(year[0].length);

  // sortpubdate shape: "2026/09/01 00:00".
  const slash = /^\/(\d{2})\/(\d{2})/.exec(rest);
  if (slash) {
    return finish(y, Number(slash[1]), Number(slash[2]));
  }

  const monthToken = /[a-z]+/.exec(rest)?.[0];
  let m: number | undefined;
  if (monthToken) {
    m = MONTHS[monthToken.slice(0, 3)] ?? SEASONS[monthToken];
    // A word we do not recognise ("winterish", "n/a" after a year) is junk,
    // not a reason to silently fall back to January.
    if (m === undefined) return none;
  }
  if (m === undefined) return { date: `${y}-01-01`, precision: "year" };

  // The day, if any, must come after the month token; "2026 Sep-Oct" has none.
  const afterMonth = rest.slice(rest.indexOf(monthToken!) + monthToken!.length);
  const dayMatch = /^[\s.]*(\d{1,2})\b/.exec(afterMonth);
  if (!dayMatch) return { date: `${y}-${pad(m)}-01`, precision: "month" };
  return finish(y, m, Number(dayMatch[1]));
}

function finish(y: number, m: number, d: number): { date: string | null; precision: DatePrecision } {
  if (m < 1 || m > 12) return { date: null, precision: "none" };
  if (d < 1 || d > DAYS_IN_MONTH[m - 1]) return { date: `${y}-${pad(m)}-01`, precision: "month" };
  return { date: `${y}-${pad(m)}-${pad(d)}`, precision: "day" };
}

/** Whole days between two ISO dates; negative never happens in practice but is not clamped. */
export function ageInDays(publishedOn: string | null, now: Date): number | null {
  if (!publishedOn) return null;
  const then = Date.parse(`${publishedOn}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

export function parseSearchResponse(json: unknown): SearchResult {
  const result = isRec(json) && isRec(json.esearchresult) ? json.esearchresult : null;
  if (!result) return { pmids: [], total: 0 };
  const list = Array.isArray(result.idlist) ? result.idlist : [];
  const pmids = list.filter((v): v is string => typeof v === "string" && /^\d+$/.test(v));
  const total = Number(result.count);
  return { pmids, total: Number.isFinite(total) ? total : 0 };
}

/**
 * A PubMed title arrives as `"Real title."` or, for a work published in
 * another language, `"[Real title]."`. Both the trailing stop and the brackets
 * are display notation rather than the title, and both look like bugs in a
 * 200-pixel-wide widget.
 */
function cleanTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let t = raw.trim();
  t = t.replace(/\.+$/, "").trim();
  if (t.startsWith("[") && t.endsWith("]")) t = t.slice(1, -1).trim();
  return t.replace(/\s+/g, " ");
}

export function parseSummary(record: unknown): Paper | null {
  if (!isRec(record)) return null;
  // PubMed returns `{ uid, error: "..." }` for an id it cannot serve.
  if (typeof record.error === "string" && record.error) return null;
  const pmid = typeof record.uid === "string" ? record.uid : null;
  const title = cleanTitle(record.title);
  if (!pmid || !title) return null;

  const articleids = Array.isArray(record.articleids) ? record.articleids : [];
  const doiEntry = articleids.find((a) => isRec(a) && a.idtype === "doi" && typeof a.value === "string");
  const doi = isRec(doiEntry) ? String(doiEntry.value) : null;

  // `authtype` is "Author" or "CollectiveName" (a study group). A study group
  // IS the author of record for many trials, so keep it.
  const authors = (Array.isArray(record.authors) ? record.authors : [])
    .map((a) => (isRec(a) && typeof a.name === "string" ? a.name.trim() : ""))
    .filter(Boolean);

  const { date, precision } =
    parsePubDate(record.pubdate).date !== null ? parsePubDate(record.pubdate) : parsePubDate(record.sortpubdate);

  const journal =
    (typeof record.fulljournalname === "string" && record.fulljournalname.trim()) ||
    (typeof record.source === "string" && record.source.trim()) ||
    null;

  const pubTypes = (Array.isArray(record.pubtype) ? record.pubtype : []).filter(
    (t): t is string => typeof t === "string",
  );

  return {
    pmid,
    title,
    journal,
    authors,
    doi,
    url: doi ? `https://doi.org/${doi}` : pubmedUrl(pmid),
    publishedOn: date,
    datePrecision: precision,
    pubTypes,
    raw: record,
  };
}

export function parseSummaries(json: unknown): Paper[] {
  const result = isRec(json) && isRec(json.result) ? json.result : null;
  if (!result) return [];
  const uids = Array.isArray(result.uids) ? result.uids : [];
  const papers: Paper[] = [];
  for (const uid of uids) {
    if (typeof uid !== "string") continue;
    const p = parseSummary(result[uid]);
    if (p) papers.push(p);
  }
  return papers;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

export function esearchUrl(query: string, days: number, limit: number): string {
  const p = new URLSearchParams({
    db: "pubmed",
    term: query,
    sort: "date",
    retmax: String(Math.max(1, Math.min(MAX_RETMAX, Math.trunc(limit) || 1))),
    retmode: "json",
    // `edat` is the Entrez date — when PubMed received the record. That is the
    // date on which a paper became new TO A READER, which is the question a
    // "newest papers" feed answers. `pdat` (publication date) would both miss
    // a late-indexed paper and re-surface an old one.
    datetype: "edat",
    reldate: String(Math.max(1, Math.trunc(days) || 1)),
    tool: TOOL,
  });
  return `${EUTILS}/esearch.fcgi?${p}`;
}

export function esummaryUrl(ids: string[]): string {
  const p = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json", tool: TOOL });
  return `${EUTILS}/esummary.fcgi?${p}`;
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

export type PubMedClientOptions = {
  fetchImpl?: typeof fetch;
  /** Minimum gap between two requests from this client. */
  spacingMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export function createPubMedClient(options: PubMedClientOptions = {}): SourceClient {
  const {
    fetchImpl = fetch,
    spacingMs = DEFAULT_SPACING_MS,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  } = options;

  let lastAt = -Infinity;
  /** One promise chain, so two concurrent callers queue instead of bursting. */
  let queue: Promise<unknown> = Promise.resolve();

  async function request(url: string): Promise<unknown> {
    const run = queue.then(async () => {
      const wait = spacingMs - (now() - lastAt);
      if (wait > 0) await sleep(wait);
      lastAt = now();
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`PubMed request failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        // NCBI serves an HTML error page under maintenance and during
        // throttling. Returning an empty feed here would look like "no new
        // papers this week", which is a lie; fail loudly instead.
        throw new Error(`PubMed returned a non-JSON body (${text.slice(0, 80)})`);
      }
    });
    // Keep the chain alive even when this request rejects.
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    async searchRecent(query, days, limit) {
      return parseSearchResponse(await request(esearchUrl(query, days, limit)));
    },
    async fetchSummaries(ids) {
      const unique = [...new Set(ids.filter((id) => /^\d+$/.test(id)))];
      if (unique.length === 0) return [];
      const papers: Paper[] = [];
      for (let i = 0; i < unique.length; i += MAX_IDS_PER_REQUEST) {
        const batch = unique.slice(i, i + MAX_IDS_PER_REQUEST);
        papers.push(...parseSummaries(await request(esummaryUrl(batch))));
      }
      return papers;
    },
  };
}

/**
 * The process-wide client. It is a singleton on purpose: the 3 req/s budget
 * belongs to the whole server, not to one request handler, so every route must
 * share one throttle.
 */
let shared: SourceClient | undefined;
export function pubmed(): SourceClient {
  shared ??= createPubMedClient();
  return shared;
}

export const searchRecent: SourceClient["searchRecent"] = (q, d, l) => pubmed().searchRecent(q, d, l);
export const fetchSummaries: SourceClient["fetchSummaries"] = (ids) => pubmed().fetchSummaries(ids);
