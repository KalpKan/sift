// GET /api/health -> { ok, service, db: "ok" | "skipped" | "error", time }
// Read by the hub's status badge and UptimeRobot. Do not rename fields.
import { buildHealth, pingSchema } from "@/lib/health";
import { getSupabase } from "@/lib/supabase";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = getSupabase();
  const body = await buildHealth(appName(), client ? () => pingSchema(client) : null);
  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
