import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for bearer secrets (CRON_SECRET,
 * SIFT_REFRESH_TOKEN). Both sides are hashed first, so the comparison never
 * short-circuits on length either.
 */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
