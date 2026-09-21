// GET /api/topics -> { topics: [{ slug, name, description, kind, source }] }
//
// The active topics, which are curated by Kalp and seeded by
// scripts/seed-topics.ts. `pubmed_query` is deliberately NOT returned here:
// it is a hand-tuned research artefact, it is long, and no client needs it for
// a topic list. /api/feed returns it for the one topic being shown.
import { getStore } from "@/lib/supabase-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  if (!store) return Response.json({ error: "database not configured" }, { status: 503 });

  try {
    const topics = await store.listTopics();
    return Response.json(
      {
        topics: topics.map((t) => ({
          slug: t.slug,
          name: t.name,
          description: t.description,
          kind: t.kind,
          source: t.source,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 502 });
  }
}
