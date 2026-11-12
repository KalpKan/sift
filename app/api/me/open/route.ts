// POST /api/me/open {pmid, surface: web|ios|widget} -> logs an open. 401 / 403 / 400 / 404.
import { handleOpen } from "@/lib/me-api";
import { meRoute } from "@/lib/me-context";

export const dynamic = "force-dynamic";
export const POST = meRoute(handleOpen);
