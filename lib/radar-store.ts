/**
 * The one real `RadarStore`: the private radar tables (migration 0003) via
 * PostgREST with the service-role key.
 *
 * WHY THE SERVICE ROLE, when these tables have per-user RLS: the routes have
 * already authenticated the caller (lib/access.ts) and every query below
 * filters on that caller's `user_id` explicitly. The papers and topics the
 * feed joins against have no policies at all (0002), so a user-scoped client
 * could not read them. RLS on 0003's tables is the guard for anyone talking to
 * PostgREST directly with the public anon key or their own JWT; this file is
 * the guard for the app. Every method takes a userId and uses it.
 */

import type { AdminSupabaseClient } from "./supabase-admin";
import { getAdminSupabase } from "./supabase-admin";
import { rowToStoredPaper, rowToTopic } from "./supabase-store";
import type { StoredPaper, Topic } from "./feed";
import type { Candidate, Interest, InterestRow, InterestSource } from "./personal";
import type { RadarStore, RatingRow, Verdict } from "./me-api";

/**
 * A topic's papers count as current if its LATEST refresh re-ranked them.
 * topic_papers is never pruned, so without this a paper from September would
 * keep the score (and the recency bonus) it was given in September forever.
 * Every paper in one refresh's 14-day fetch shares that refresh's ranked_at, so
 * "ranked within 36 hours of the topic's newest ranked_at" is exactly the last
 * refresh or two. Relative to each topic's own newest row, not to the clock: a
 * topic whose refresh failed for a week still shows its last good papers, and
 * the feed's updatedAt says how old they are.
 */
export const CANDIDATE_WINDOW_MS = 36 * 60 * 60 * 1000;
/** Per followed topic. Four topics x 60 is the most p1 ever re-ranks. */
export const CANDIDATES_PER_TOPIC = 60;

const TOPIC_COLUMNS = "id, slug, name, pubmed_query, description, kind, source, is_active";
const FEED_SELECT =
  "pmid, score, score_reasons, ranked_at, papers!inner(pmid, title, journal, authors, doi, url, published_on, pub_types, first_seen_at)";

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createRadarStore(client: AdminSupabaseClient): RadarStore {
  async function topicPapers(topic: Topic): Promise<StoredPaper[]> {
    const { data: newest, error: nErr } = await client
      .from("topic_papers")
      .select("ranked_at")
      .eq("topic_id", topic.id)
      .order("ranked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    fail("readCandidates/newest", nErr);
    if (!newest) return [];
    const since = new Date(Date.parse(newest.ranked_at) - CANDIDATE_WINDOW_MS).toISOString();
    const { data, error } = await client
      .from("topic_papers")
      .select(FEED_SELECT)
      .eq("topic_id", topic.id)
      .gte("ranked_at", since)
      .order("score", { ascending: false })
      .limit(CANDIDATES_PER_TOPIC);
    fail("readCandidates", error);
    return ((data ?? []) as unknown as Parameters<typeof rowToStoredPaper>[0][])
      .map(rowToStoredPaper)
      .filter((p): p is StoredPaper => p !== null);
  }

  return {
    async isOwner(userId) {
      const { data, error } = await client.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
      fail("isOwner", error);
      return data !== null;
    },

    async createOwner(userId, followSlugs) {
      const { error } = await client
        .from("profiles")
        .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id", ignoreDuplicates: true });
      fail("createOwner/profile", error);
      if (followSlugs.length === 0) return;
      const { data: topics, error: tErr } = await client.from("topics").select("id").in("slug", [...followSlugs]);
      fail("createOwner/topics", tErr);
      const rows = (topics ?? []).map((t) => ({ user_id: userId, topic_id: t.id }));
      if (rows.length === 0) return;
      const { error: fErr } = await client
        .from("follows")
        .upsert(rows, { onConflict: "user_id,topic_id", ignoreDuplicates: true });
      fail("createOwner/follows", fErr);
    },

    async listTopics() {
      const { data, error } = await client.from("topics").select(TOPIC_COLUMNS).eq("is_active", true).order("name");
      fail("listTopics", error);
      return (data ?? []).map((r) => rowToTopic(r as Parameters<typeof rowToTopic>[0]));
    },

    async listFollows(userId) {
      const { data, error } = await client.from("follows").select("topic_id").eq("user_id", userId);
      fail("listFollows", error);
      return (data ?? []).map((r) => r.topic_id);
    },

    async setFollows(userId, topicIds) {
      const { error } = await client.from("follows").delete().eq("user_id", userId);
      fail("setFollows/delete", error);
      if (topicIds.length === 0) return;
      const { error: insErr } = await client
        .from("follows")
        .insert(topicIds.map((topic_id) => ({ user_id: userId, topic_id })));
      fail("setFollows/insert", insErr);
    },

    async readCandidates(topics) {
      const lists = await Promise.all(topics.map((t) => topicPapers(t)));
      return topics.flatMap((t, i): Candidate[] => lists[i].map((paper) => ({ paper, topic: t.slug, kind: t.kind })));
    },

    async listInterests(userId) {
      const { data, error } = await client.from("interests").select("term, weight, source").eq("user_id", userId);
      fail("listInterests", error);
      return (data ?? []) as InterestRow[];
    },

    async deleteInterest(userId, term, source) {
      const { data, error } = await client
        .from("interests")
        .delete()
        .eq("user_id", userId)
        .eq("term", term)
        .eq("source", source)
        .select("term");
      fail("deleteInterest", error);
      return (data ?? []).length;
    },

    async upsertInterests(userId, source: InterestSource, rows: readonly Interest[]) {
      if (rows.length === 0) return;
      const now = new Date().toISOString();
      const { error } = await client.from("interests").upsert(
        rows.map((r) => ({ user_id: userId, term: r.term, weight: r.weight, source, updated_at: now })),
        { onConflict: "user_id,term,source" },
      );
      fail("upsertInterests", error);
    },

    async getPaper(pmid) {
      const { data, error } = await client.from("papers").select("pmid, title, journal").eq("pmid", pmid).maybeSingle();
      fail("getPaper", error);
      return data ?? null;
    },

    async getRatings(userId) {
      const { data, error } = await client.from("ratings").select("pmid, verdict").eq("user_id", userId);
      fail("getRatings", error);
      return new Map((data ?? []).map((r) => [r.pmid, r.verdict as Verdict]));
    },

    async upsertRating(row: RatingRow) {
      const { error } = await client.from("ratings").upsert(
        {
          user_id: row.userId,
          pmid: row.pmid,
          topic_id: row.topicId,
          verdict: row.verdict,
          shown_rank: row.shownRank,
          recency_rank: row.recencyRank,
          ranker_version: row.rankerVersion,
          surface: row.surface,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pmid" },
      );
      fail("upsertRating", error);
    },

    async insertOpen(row) {
      const { error } = await client.from("opens").insert({ user_id: row.userId, pmid: row.pmid, surface: row.surface });
      fail("insertOpen", error);
    },
  };
}

/** Null when the database env is unset, like `getStore()`. */
export function getRadarStore(): RadarStore | null {
  const client = getAdminSupabase();
  return client ? createRadarStore(client) : null;
}
