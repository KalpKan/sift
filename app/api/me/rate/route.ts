// POST /api/me/rate {pmid, verdict: 1|-1, surface, shownRank, recencyRank, rankerVersion, topic?}
// One row per (user, paper); a re-tap updates it and nudges the matched
// interest terms (lib/personal.ts tapDeltas). 401 / 403 / 400 / 404.
import { handleRate } from "@/lib/me-api";
import { meRoute } from "@/lib/me-context";

export const dynamic = "force-dynamic";
export const POST = meRoute(handleRate);
