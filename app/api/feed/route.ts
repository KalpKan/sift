// GET /api/feed?topic=<slug>&limit=10
//   -> { topic, id, name, query, updatedAt, papers: [...] }
//
// The one endpoint the iPhone app calls. `papers[]` matches
// ios/Shared/Paper.swift field for field, so changing a name here breaks the
// widget silently — see lib/feed.ts for the contract and the tests that pin it.
//
// Reads from the database. Refreshes from PubMed first only when the topic's
// newest ranking is more than six hours old (lib/feed.ts, REFRESH_AFTER_MS),
// so an ordinary request costs one query and no NCBI traffic.
import { clampLimit, getFeed } from "@/lib/feed";
import { pubmed } from "@/lib/pubmed";
import { getStore } from "@/lib/supabase-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("topic")?.trim();
  if (!slug) {
    return Response.json({ error: "missing ?topic=<slug>" }, { status: 400 });
  }

  const store = getStore();
  if (!store) {
    return Response.json({ error: "database not configured" }, { status: 503 });
  }

  try {
    const feed = await getFeed({
      store,
      source: pubmed(),
      slug,
      limit: clampLimit(url.searchParams.get("limit")),
      now: new Date(),
    });
    if (!feed) return Response.json({ error: `unknown topic: ${slug}` }, { status: 404 });
    return Response.json(feed, {
      headers: {
        // The server already caches in Postgres for six hours; let a CDN hold
        // it for five minutes and serve the stale copy for an hour while it
        // revalidates, so a cold Vercel function never blocks the widget.
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
