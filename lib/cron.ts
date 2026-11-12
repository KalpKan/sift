/**
 * The daily refresh (vercel.json `crons`, once a day: the Hobby plan's limit).
 *
 * Vercel calls the cron path with GET and `Authorization: Bearer $CRON_SECRET`.
 * Every active topic is refreshed, one after another (NCBI allows 3 requests a
 * second without a key, and each topic is two requests), so the radar and the
 * widget never wait on a slow lazy fetch. One failing topic does not stop the
 * others; each still leaves its refresh_runs row.
 */

import { refreshTopic, type FeedStore } from "./feed";
import type { SourceClient } from "./pubmed";

export const CRON_SECRET_ENV = "CRON_SECRET";

/** Fails closed: no secret configured means no caller is authorised. */
export function isAuthorizedCron(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env[CRON_SECRET_ENV]?.trim();
  if (!secret || !header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m !== null && m[1].trim() === secret;
}

export type TopicRefresh = { topic: string; seen: number; added: number; error: string | null };

export async function refreshAllTopics(args: { store: FeedStore; source: SourceClient; now: Date }): Promise<TopicRefresh[]> {
  const out: TopicRefresh[] = [];
  for (const topic of await args.store.listTopics()) {
    try {
      const r = await refreshTopic({ store: args.store, source: args.source, topic, now: args.now });
      out.push({ topic: topic.slug, seen: r.seen, added: r.added, error: null });
    } catch (e) {
      out.push({ topic: topic.slug, seen: 0, added: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
