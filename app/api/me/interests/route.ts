// GET /api/me/interests -> {interests: [{term, weight, source}], combined: [{term, weight}]}
// DELETE /api/me/interests?term=<term>&source=obsidian|taps|manual
// Private rows: only ever shown on /me/settings (docs/obsidian-bridge.md, rule 4).
import { handleInterests } from "@/lib/me-api";
import { meRoute } from "@/lib/me-context";

export const dynamic = "force-dynamic";
export const GET = meRoute(handleInterests);
export const DELETE = meRoute(handleInterests);
