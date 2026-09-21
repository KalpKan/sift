import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "..", "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const raw = files
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n")
  .toLowerCase();
/**
 * The SQL with `--` comments stripped, so prose in a comment (which in this
 * migration explains at length why topics are curated) can never satisfy a
 * check that is meant to be about real column definitions.
 */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/**
 * The four tables Sift needs. The shape follows the pipeline:
 *   `topics`       — what Kalp curates, one hand-tuned PubMed query each
 *   `papers`       — the deduplicated firehose, keyed by PMID
 *   `topic_papers` — the join that carries the SCORE, i.e. the product
 *   `refresh_runs` — the audit trail, so a silent failure is visible
 */
const TABLES = ["topics", "papers", "topic_papers", "refresh_runs"] as const;

describe("sift core schema (0002)", () => {
  it("creates every table in the sift schema, never in public", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`create table if not exists sift.${t}`);
    }
    expect(sql).not.toMatch(/\bpublic\./);
  });

  it("enables row level security on every table", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`alter table sift.${t} enable row level security`);
    }
  });

  it("defines no policy at all, so RLS denies everyone but the service role", () => {
    // Deny-by-default. Every read and write in this app happens server-side
    // with the service-role key, which bypasses RLS; anon and authenticated
    // see zero rows. Adding a policy must be a deliberate, reviewed change.
    expect(sql).not.toContain("create policy");
  });

  describe("topics", () => {
    it("keys on a uuid and carries a unique slug", () => {
      expect(sql).toMatch(/id\s+uuid\s+primary key/);
      expect(sql).toMatch(/slug\s+text\s+not null\s+unique/);
    });

    it("stores the hand-tuned pubmed query and an active flag", () => {
      expect(sql).toMatch(/pubmed_query\s+text\s+not null/);
      expect(sql).toMatch(/source\s+text\s+not null\s+default 'pubmed'/);
      expect(sql).toMatch(/is_active\s+boolean\s+not null\s+default true/);
      expect(sql).toMatch(/name\s+text\s+not null/);
      expect(sql).toMatch(/description\s+text/);
      // Clinical vs engineering: the ranker weights publication type very
      // differently for the two, because 60% of engineering papers have none.
      expect(sql).toMatch(/kind\s+text\s+not null\s+default 'clinical'\s+check \(kind in \('clinical', 'engineering'\)\)/);
      expect(sql).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/);
    });

    it("records in a comment that topics are curated, not user free-text", () => {
      // The product decision: a naive query returns 280 papers a week, a
      // hand-tuned one returns the right ones. This must survive refactors.
      expect(raw).toMatch(/curat/);
    });
  });

  describe("papers", () => {
    it("keys on the pmid, because pubmed already deduplicates for us", () => {
      expect(sql).toMatch(/pmid\s+text\s+primary key/);
    });

    it("stores the fields the widget renders, with a title that cannot be null", () => {
      expect(sql).toMatch(/title\s+text\s+not null/);
      expect(sql).toMatch(/journal\s+text/);
      expect(sql).toMatch(/authors\s+text\[\]/);
      expect(sql).toMatch(/doi\s+text/);
      expect(sql).toMatch(/url\s+text/);
      expect(sql).toMatch(/published_on\s+date/);
      expect(sql).toMatch(/pub_types\s+text\[\]/);
      expect(sql).toMatch(/first_seen_at\s+timestamptz\s+not null\s+default now\(\)/);
      expect(sql).toMatch(/raw\s+jsonb/);
    });
  });

  describe("topic_papers", () => {
    it("is keyed by (topic_id, pmid) so a re-rank updates rather than duplicates", () => {
      expect(sql).toMatch(/primary key\s*\(\s*topic_id\s*,\s*pmid\s*\)/);
    });

    it("stores an integer score that cannot be null, plus the reasons behind it", () => {
      expect(sql).toMatch(/score\s+integer\s+not null/);
      expect(sql).toMatch(/score_reasons\s+jsonb/);
      expect(sql).toMatch(/ranked_at\s+timestamptz\s+not null\s+default now\(\)/);
    });

    it("cascades from topics and papers, so deleting a topic cannot orphan rows", () => {
      expect(sql).toMatch(/references sift\.topics\s*\(\s*id\s*\)\s*on delete cascade/);
      expect(sql).toMatch(/references sift\.papers\s*\(\s*pmid\s*\)\s*on delete cascade/);
    });
  });

  describe("refresh_runs", () => {
    it("records what each refresh saw, added, and failed at", () => {
      expect(sql).toMatch(/started_at\s+timestamptz\s+not null\s+default now\(\)/);
      expect(sql).toMatch(/finished_at\s+timestamptz/);
      expect(sql).toMatch(/papers_seen\s+integer/);
      expect(sql).toMatch(/papers_added\s+integer/);
      expect(sql).toMatch(/error\s+text/);
    });
  });

  describe("indexes", () => {
    it("indexes the feed query: topic_papers by topic, best score first", () => {
      // GET /api/feed is exactly `where topic_id = $1 order by score desc`.
      expect(sql).toMatch(
        /create index if not exists topic_papers_topic_id_score_idx\s+on sift\.topic_papers\s*\(\s*topic_id\s*,\s*score desc\s*\)/,
      );
    });

    it("indexes every foreign key column", () => {
      // topic_papers.topic_id is the leading column of the feed index above,
      // which is what Postgres needs for the FK; the other two get their own.
      for (const idx of ["topic_papers_pmid_idx", "refresh_runs_topic_id_idx"]) {
        expect(sql).toContain(idx);
      }
    });

    it("indexes topics.is_active, the filter behind GET /api/topics", () => {
      expect(sql).toContain("topics_is_active_idx");
    });
  });
});
