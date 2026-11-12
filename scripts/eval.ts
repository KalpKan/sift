/**
 * npm run eval : prints precision@3 and @10 for p1, h1 and newest-first over
 * the papers Kalp rated, and the acceptance gate (lib/eval.ts).
 *
 * Reads sift.ratings, sift.interests, sift.papers and sift.topic_papers with
 * the service-role key from .env.local. Read-only. Local only: it never runs on
 * Vercel. On this Mac: `env -u NODE_OPTIONS npm run eval`.
 */
import { evaluate, formatReport, type RatedPaper } from "../lib/eval";
import type { InterestRow } from "../lib/personal";
import { getAdminSupabase } from "../lib/supabase-admin";

function ms(date: string | null): number {
  if (!date) return 0;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
  return Number.isNaN(t) ? 0 : t;
}

async function main() {
  const db = getAdminSupabase();
  if (!db) throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_APP_SCHEMA must be set (.env.local)");

  const { data: owners, error: oErr } = await db.from("profiles").select("user_id").eq("role", "owner");
  if (oErr) throw new Error(oErr.message);
  if (!owners?.length) {
    console.log("No owner yet: sign in at https://sift.kalpkan.com/me first.");
    return;
  }

  for (const { user_id } of owners) {
    const { data: ratings, error: rErr } = await db
      .from("ratings")
      .select("pmid, verdict, papers!inner(title, journal, published_on, first_seen_at)")
      .eq("user_id", user_id);
    if (rErr) throw new Error(rErr.message);
    const pmids = (ratings ?? []).map((r) => r.pmid);

    const h1 = new Map<string, number>();
    for (let i = 0; i < pmids.length; i += 200) {
      const { data, error } = await db.from("topic_papers").select("pmid, score").in("pmid", pmids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const r of data ?? []) h1.set(r.pmid, Math.max(h1.get(r.pmid) ?? -Infinity, r.score));
    }

    const { data: interests, error: iErr } = await db.from("interests").select("term, weight, source").eq("user_id", user_id);
    if (iErr) throw new Error(iErr.message);

    const rated: RatedPaper[] = (ratings ?? []).map((r) => {
      const p = r.papers as unknown as { title: string; journal: string | null; published_on: string | null; first_seen_at: string };
      return {
        pmid: r.pmid,
        verdict: r.verdict === 1 ? 1 : -1,
        title: p.title,
        journal: p.journal,
        h1: h1.get(r.pmid) ?? 0,
        publishedMs: ms(p.published_on) || ms(p.first_seen_at),
      };
    });

    if (owners.length > 1) console.log(`\nowner ${user_id.slice(0, 8)}…`);
    console.log(formatReport(evaluate(rated, (interests ?? []) as InterestRow[])));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
