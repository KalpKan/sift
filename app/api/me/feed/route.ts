// GET /api/me/feed?limit=10 -> the private radar (lib/me-api.ts handleFeed).
// 401 signed out, 403 non-owner. Same envelope as /api/feed, so the iPhone
// app's Feed decodes it unchanged; each paper adds shownRank, recencyRank,
// rankerVersion, topic and verdict. Cookie session (web) or Bearer token (iOS).
import { handleFeed } from "@/lib/me-api";
import { meRoute } from "@/lib/me-context";

export const dynamic = "force-dynamic";
export const GET = meRoute(handleFeed);
