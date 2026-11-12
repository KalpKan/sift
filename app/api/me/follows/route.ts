// GET /api/me/follows -> {topics: [{slug, name, followed}]}
// PUT /api/me/follows {slugs: string[]} replaces the followed set.
import { handleFollows } from "@/lib/me-api";
import { meRoute } from "@/lib/me-context";

export const dynamic = "force-dynamic";
export const GET = meRoute(handleFollows);
export const PUT = meRoute(handleFollows);
