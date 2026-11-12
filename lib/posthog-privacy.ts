/**
 * Analytics never sees the private radar.
 *
 * Every app on kalpkan.com runs PostHog with autocapture and session replay
 * (docs/analytics.md). On Sift's private pages (/me, /me/settings, /sign-in,
 * /auth/*) that would record Kalp's interest terms and weights, his email,
 * paper titles and "matches your interest: <term>" reasons: replay copies the
 * DOM and autocapture sends element text and aria-labels. Four layers:
 *
 *   0. Heatmaps and dead-click capture are OFF site-wide (lib/posthog.ts):
 *      their batches can carry coordinates from a private page while being
 *      sent from a public one, which no per-event path check can catch.
 *   1. `privacyBeforeSend` (PostHog's before_send): on a private path, every
 *      event is dropped except the radar's own `paper_opened` / `paper_rated`,
 *      and those keep only `pmid`, `verdict` and PostHog's `$session_id`-style
 *      context. Judged by the current path AND the event's own URL, so an event
 *      queued on /me and sent after navigating away is still dropped.
 *   2. `syncRecording`: replay is stopped on entering a private path (client
 *      navigation from / keeps the recorder running otherwise) and restarted on
 *      leaving, only if this guard stopped it.
 *   3. `ph-no-capture` on the private pages' roots, which both autocapture and
 *      the replay recorder honour.
 */

import type { CaptureResult } from "posthog-js";

const PRIVATE_PREFIXES = ["/me", "/sign-in", "/auth"];

export const PRIVATE_EVENT_ALLOWLIST = ["paper_opened", "paper_rated"] as const;

/** Properties a radar event may carry: its own two, plus PostHog's session plumbing. */
const KEEP = new Set(["pmid", "verdict", "$session_id", "$window_id", "$lib", "$lib_version", "token", "distinct_id"]);

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function pathOf(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url, "https://sift.kalpkan.com").pathname;
  } catch {
    return null;
  }
}

export function privacyBeforeSend(result: CaptureResult | null, currentPath: string): CaptureResult | null {
  if (!result) return null;
  const props = (result.properties ?? {}) as Record<string, unknown>;
  const paths = [currentPath, pathOf(props.$current_url), typeof props.$pathname === "string" ? props.$pathname : null];
  if (!paths.some((p) => p !== null && isPrivatePath(p))) return result;

  if (!(PRIVATE_EVENT_ALLOWLIST as readonly string[]).includes(result.event)) return null;
  const kept = Object.fromEntries(Object.entries(props).filter(([k]) => KEEP.has(k)));
  return { ...result, properties: kept } as CaptureResult;
}

type Recorder = {
  sessionRecordingStarted(): boolean;
  stopSessionRecording(): void;
  startSessionRecording(): void;
};

let stoppedByGuard = false;

export function syncRecording(ph: Recorder, pathname: string): void {
  if (isPrivatePath(pathname)) {
    ph.stopSessionRecording();
    stoppedByGuard = true;
  } else if (stoppedByGuard) {
    stoppedByGuard = false;
    ph.startSessionRecording();
  }
}
