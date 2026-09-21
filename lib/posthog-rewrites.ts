/**
 * Rewrite rules for next.config.ts: `/ingest/*` on this origin becomes
 * PostHog's US cloud, so analytics requests are first-party and ad blockers
 * do not drop them. Kept free of any browser import because next.config.ts
 * loads it in Node at build time.
 */
export function posthogRewrites() {
  return [
    {
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    },
  ];
}
