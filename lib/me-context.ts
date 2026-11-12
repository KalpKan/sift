/**
 * Wires the real context into lib/me-api.ts's handlers and the /me pages.
 * Server-only.
 */

import { readOwnerEmails, resolveViewer, type ViewerResult } from "./access";
import { userFromBearer, userFromCookies } from "./auth-server";
import type { MeContext } from "./me-api";
import { getRadarStore } from "./radar-store";

export function getMeContext(): MeContext | null {
  const radar = getRadarStore();
  if (!radar) return null;
  return {
    radar,
    now: new Date(),
    viewer: {
      userFromBearer,
      userFromCookies,
      isOwner: (id) => radar.isOwner(id),
      createOwner: (id, slugs) => radar.createOwner(id, slugs),
      ownerEmails: readOwnerEmails(),
    },
  };
}

/** Route-handler wrapper: 503 when the database is not configured. */
export function meRoute(handler: (request: Request, ctx: MeContext) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const ctx = getMeContext();
    if (!ctx) return Response.json({ error: "database not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    try {
      return await handler(request, ctx);
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "unknown error" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}

/** For the /me pages: who is looking, by cookie session only. */
export async function pageViewer(ctx: MeContext): Promise<ViewerResult> {
  return resolveViewer(null, ctx.viewer);
}
