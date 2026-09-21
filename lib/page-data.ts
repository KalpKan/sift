/**
 * Server-component data loading. The pages call this instead of fetching
 * /api/feed over HTTP: they run on the same machine, so a round trip through
 * the router would only add latency and a second failure mode.
 *
 * Every function here degrades instead of throwing. A page that cannot reach
 * PubMed or Postgres still has to render — this app's whole promise is "here
 * is what is new", and an error page is a worse answer than an honest
 * "couldn't reach PubMed just now".
 */

import { clampLimit, getFeed, type FeedResponse, type Topic } from "./feed";
import { pubmed } from "./pubmed";
import { getStore } from "./supabase-store";

export type LoadResult<T> = { data: T | null; error: string | null };

const NO_DB = "The database is not configured for this deployment.";

export async function loadTopics(): Promise<LoadResult<Topic[]>> {
  const store = getStore();
  if (!store) return { data: null, error: NO_DB };
  try {
    return { data: await store.listTopics(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "unknown error" };
  }
}

export async function loadFeed(slug: string, limit: number): Promise<LoadResult<FeedResponse>> {
  const store = getStore();
  if (!store) return { data: null, error: NO_DB };
  try {
    const feed = await getFeed({
      store,
      source: pubmed(),
      slug,
      limit: clampLimit(String(limit)),
      now: new Date(),
    });
    return { data: feed, error: feed ? null : `No topic called "${slug}".` };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "unknown error" };
  }
}

/**
 * "6 hours ago", for the one place the page states its own freshness. Rounded
 * down and coarse on purpose: claiming more precision than a six-hour cache
 * has would be a lie.
 */
export function freshness(updatedAt: string, now: Date): string {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return "at an unknown time";
  const mins = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
