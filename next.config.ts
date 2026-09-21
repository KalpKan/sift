import type { NextConfig } from "next";
import { posthogRewrites } from "./lib/posthog-rewrites";

const nextConfig: NextConfig = {
  // PostHog reverse proxy: the browser talks to /ingest on this origin and
  // Next.js forwards to PostHog's US cloud (KalpKan/portfolio docs/analytics.md).
  async rewrites() {
    return posthogRewrites();
  },
  // PostHog's API endpoints keep their trailing slash (/ingest/e/), so Next
  // must not 308-redirect them to a slash-less path.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
