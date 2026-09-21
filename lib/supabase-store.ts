/**
 * The one real `FeedStore`: `sift` tables via PostgREST, with the service-role
 * key. Everything interesting about the feed lives in lib/feed.ts; this file
 * is only the translation between Postgres rows and the app's types, plus the
 * queries.
 *
 * The row<->type mappers are exported and pure so they can be unit-tested
 * without a database, which is the only part of this file worth testing.
 */

import { getAdminSupabase, type AdminSupabaseClient } from "./supabase-admin";
import type { FeedStore, RunResult, ScoreRow, StoredPaper, Topic } from "./feed";
import type { Paper } from "./pubmed";
import type { TopicKind } from "./ranking";

type TopicRow = {
  id: string;
  slug: string;
  name: string;
  pubmed_query: string;
  description: string | null;
  kind: string;
  source: string;
  is_active: boolean;
};

type PaperRow = {
  pmid: string;
  title: string;
  journal: string | null;
  authors: string[] | null;
  doi: string | null;
  url: string | null;
  published_on: string | null;
  pub_types: string[] | null;
  first_seen_at?: string | null;
  raw?: unknown;
};

export function rowToTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    pubmedQuery: row.pubmed_query,
    description: row.description,
    // Anything unexpected falls back to the safer default rather than throwing:
    // a bad label must not take the whole feed down.
    kind: row.kind === "engineering" ? "engineering" : ("clinical" as TopicKind),
    source: row.source,
    isActive: row.is_active,
  };
}

export function paperToRow(p: Paper): PaperRow {
  return {
    pmid: p.pmid,
    title: p.title,
    journal: p.journal,
    authors: p.authors,
    doi: p.doi,
    url: p.url,
    published_on: p.publishedOn,
    pub_types: p.pubTypes,
    raw: p.raw as PaperRow["raw"],
  };
}

export function rowToPaper(row: PaperRow): Paper {
  return {
    pmid: row.pmid,
    title: row.title,
    journal: row.journal,
    authors: row.authors ?? [],
    doi: row.doi,
    url: row.url ?? `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`,
    publishedOn: row.published_on,
    // Not stored: `datePrecision` is only used while parsing, and the ranker
    // does not read it. Reconstructed as "day" rather than adding a column.
    datePrecision: row.published_on ? "day" : "none",
    pubTypes: row.pub_types ?? [],
    raw: row.raw ?? null,
  };
}

/** A `topic_papers` row joined to its paper, as PostgREST embeds it. */
type FeedRow = {
  pmid: string;
  score: number;
  score_reasons: unknown;
  ranked_at: string;
  papers: PaperRow | null;
};

export function rowToStoredPaper(row: FeedRow): StoredPaper | null {
  if (!row.papers) return null;
  return {
    ...rowToPaper(row.papers),
    score: row.score,
    // `score_reasons` is jsonb, so it can be anything. Coerce defensively:
    // a malformed reason list must not break a whole feed render.
    reasons: Array.isArray(row.score_reasons) ? row.score_reasons.filter((r): r is string => typeof r === "string") : [],
    rankedAt: row.ranked_at,
    firstSeenAt: row.papers.first_seen_at ?? null,
  };
}

const TOPIC_COLUMNS = "id, slug, name, pubmed_query, description, kind, source, is_active";

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createSupabaseStore(client: AdminSupabaseClient): FeedStore {
  // The generated `Database` types describe each table exactly. The casts
  // below are only where supabase-js cannot infer the shape of a PostgREST
  // embedded select, or of an upsert payload built from a mapper.
  return {
    async getTopic(slug) {
      const { data, error } = await client
        .from("topics")
        .select(TOPIC_COLUMNS)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      fail("getTopic", error);
      return data ? rowToTopic(data as unknown as TopicRow) : null;
    },

    async listTopics() {
      const { data, error } = await client
        .from("topics")
        .select(TOPIC_COLUMNS)
        .eq("is_active", true)
        .order("name", { ascending: true });
      fail("listTopics", error);
      return ((data ?? []) as unknown as TopicRow[]).map(rowToTopic);
    },

    async newestRankedAt(topicId) {
      const { data, error } = await client
        .from("topic_papers")
        .select("ranked_at")
        .eq("topic_id", topicId)
        .order("ranked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      fail("newestRankedAt", error);
      return (data as { ranked_at: string } | null)?.ranked_at ?? null;
    },

    async upsertPapers(papers) {
      if (papers.length === 0) return 0;
      // "Added" means new to Sift, which is what the refresh log is for. Ask
      // which PMIDs we already hold before writing, rather than trusting an
      // upsert to tell us (PostgREST cannot distinguish insert from update).
      const pmids = papers.map((p) => p.pmid);
      const { data: existing, error: readError } = await client.from("papers").select("pmid").in("pmid", pmids);
      fail("upsertPapers/select", readError);
      const known = new Set(((existing ?? []) as { pmid: string }[]).map((r) => r.pmid));

      const { error } = await client
        .from("papers")
        .upsert(papers.map(paperToRow) as never, { onConflict: "pmid" });
      fail("upsertPapers", error);
      return pmids.filter((id) => !known.has(id)).length;
    },

    async upsertScores(topicId, rows: ScoreRow[]) {
      if (rows.length === 0) return;
      const { error } = await client.from("topic_papers").upsert(
        rows.map((r) => ({
          topic_id: topicId,
          pmid: r.pmid,
          score: r.score,
          score_reasons: r.reasons,
          ranked_at: r.rankedAt,
        })) as never,
        { onConflict: "topic_id,pmid" },
      );
      fail("upsertScores", error);
    },

    async readFeed(topicId, limit) {
      // One round trip: PostgREST embeds the paper via the foreign key, and
      // the (topic_id, score desc) index answers the sort without a sort.
      const { data, error } = await client
        .from("topic_papers")
        .select(
          "pmid, score, score_reasons, ranked_at, papers!inner(pmid, title, journal, authors, doi, url, published_on, pub_types, first_seen_at)",
        )
        .eq("topic_id", topicId)
        .order("score", { ascending: false })
        .limit(limit);
      fail("readFeed", error);
      return ((data ?? []) as unknown as FeedRow[])
        .map(rowToStoredPaper)
        .filter((p): p is StoredPaper => p !== null);
    },

    async startRun(topicId) {
      const { data, error } = await client
        .from("refresh_runs")
        .insert({ topic_id: topicId } as never)
        .select("id")
        .single();
      fail("startRun", error);
      return (data as unknown as { id: string }).id;
    },

    async finishRun(runId, result: RunResult) {
      const { error } = await client
        .from("refresh_runs")
        .update({
          finished_at: new Date().toISOString(),
          papers_seen: result.seen,
          papers_added: result.added,
          error: result.error,
        } as never)
        .eq("id", runId);
      fail("finishRun", error);
    },
  };
}

/** Null when the database env is unset, exactly like `getSupabase()`. */
export function getStore(): FeedStore | null {
  const client = getAdminSupabase();
  return client ? createSupabaseStore(client) : null;
}
