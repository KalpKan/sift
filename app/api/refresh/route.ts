// POST /api/refresh?topic=<slug> -> { topic, seen, added }
//
// Forces a PubMed refresh, ignoring the six-hour cache. This is the only route
// that can make the server spend its shared NCBI rate budget on demand, so it
// is authenticated with a bearer token from SIFT_REFRESH_TOKEN.
//
// FAILS CLOSED: with no token configured the route answers 503 and refuses,
// rather than being an open endpoint anyone can use to hammer NCBI from our IP.
import { clampLimit, getFeed } from "@/lib/feed";
import { pubmed } from "@/lib/pubmed";
import { getStore } from "@/lib/supabase-store";
import { isAuthorizedRefresh, readRefreshToken } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readRefreshToken();
  if (!token) {
    return Response.json({ error: "refresh is disabled: SIFT_REFRESH_TOKEN is not set" }, { status: 503 });
  }
  if (!isAuthorizedRefresh(request.headers.get("authorization"), token)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("topic")?.trim();
  if (!slug) return Response.json({ error: "missing ?topic=<slug>" }, { status: 400 });

  const store = getStore();
  if (!store) return Response.json({ error: "database not configured" }, { status: 503 });

  try {
    const feed = await getFeed({
      store,
      source: pubmed(),
      slug,
      limit: clampLimit(url.searchParams.get("limit")),
      now: new Date(),
      force: true,
    });
    if (!feed) return Response.json({ error: `unknown topic: ${slug}` }, { status: 404 });
    return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 502 });
  }
}
