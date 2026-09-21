/**
 * Lazy entry point for custom PostHog events from components.
 *
 * Components import this instead of lib/posthog so posthog-js stays out of
 * the initial JavaScript bundle (PostHogProvider boots it after `load`). By
 * the time anyone clicks, the module is already in memory and the call is a
 * plain `capture` with `send_instantly` (see lib/posthog.ts).
 */
export function track(event: string, props?: Record<string, unknown>): void {
  import("@/lib/posthog").then((m) => m.capture(event, props));
}
