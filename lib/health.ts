import type { AppSupabaseClient } from "./supabase";

/**
 * The health contract every app on kalpkan.com follows. The hub's status
 * badge and UptimeRobot both read `GET /api/health` and treat anything but a
 * 2xx JSON body with `ok: true` as "down". Do not rename these fields.
 */
export type HealthBody = {
  ok: boolean;
  service: string;
  db: "ok" | "skipped" | "error";
  time: string;
};

export type Ping = () => Promise<boolean>;

/**
 * `ping` is null when the app has no database configured (env unset): the
 * route then answers `db: "skipped"` and stays healthy, because a template
 * deploy or a static demo has nothing to check.
 */
export async function buildHealth(service: string, ping: Ping | null): Promise<HealthBody> {
  const time = new Date().toISOString();
  if (!ping) return { ok: true, service, db: "skipped", time };
  let up = false;
  try {
    up = await ping();
  } catch {
    up = false;
  }
  return up ? { ok: true, service, db: "ok", time } : { ok: false, service, db: "error", time };
}

/**
 * `select 1` against this app's schema, through the `health_select_one()`
 * function that migration 0001 creates. supabase-js has no raw-SQL path, and
 * an RPC exercises the same PostgREST route, grants and exposed-schema
 * setting that real queries use, so a false here means real queries fail too.
 */
export async function pingSchema(client: AppSupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("health_select_one");
  return !error && data === 1;
}
