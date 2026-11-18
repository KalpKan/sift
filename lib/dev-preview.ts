/**
 * The dev preview (`/dev/*`) renders the private pages with fixture data so a
 * screenshot tester can see them without Google sign-in. It is gated by an
 * env var, not NODE_ENV, because testers run it under `next start`. On Vercel
 * it is always off, whatever the variable says.
 */
export function isDevPreviewEnabled(env: Record<string, string | undefined>): boolean {
  return env.SIFT_DEV_PREVIEW === "1" && !env.VERCEL;
}
