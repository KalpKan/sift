import posthog from "posthog-js";
import type { PostHogConfig } from "posthog-js";

/**
 * The analytics contract every app on kalpkan.com follows (docs/analytics.md).
 *
 * - Cookieless: `persistence: "memory"` stores nothing in the browser, so no
 *   cookie banner is needed on a personal portfolio.
 * - First-party: `api_host: "/ingest"` is rewritten by Next.js to PostHog's
 *   US ingest hosts (see `posthogRewrites`), which ad blockers do not catch.
 * - Autocapture on, pageviews on, session replay on with every input masked.
 */
export const POSTHOG_INIT_OPTIONS = {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  persistence: "memory",
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  session_recording: { maskAllInputs: true },
  disable_surveys: true,
} satisfies Partial<PostHogConfig>;

export { posthogRewrites } from "./posthog-rewrites";

let initialised = false;

/**
 * Initialise once per page load. With no key (local dev without .env, or a
 * fork) this is a silent no-op so the site works without analytics.
 */
export function initPostHog(key: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_KEY): void {
  if (initialised || !key || typeof window === "undefined") return;
  initialised = true;
  posthog.init(key, {
    ...POSTHOG_INIT_OPTIONS,
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_INIT_OPTIONS.api_host,
  });
}

/**
 * Fire a custom event. Names are snake_case past-tense verbs, e.g.
 * `project_card_clicked`. Safe to call before init or without a key.
 *
 * Sent immediately over `sendBeacon` rather than the 3 s batch, because the
 * core actions on this platform are clicks that navigate away (a project row
 * opens another site) and a queued event dies with the page.
 */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (!initialised) return;
  posthog.capture(event, props, { send_instantly: true, transport: "sendBeacon" });
}
