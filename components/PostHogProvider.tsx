"use client";

import { useEffect } from "react";

/**
 * Boots PostHog once on the client. Renders nothing extra; with no
 * NEXT_PUBLIC_POSTHOG_KEY it does nothing at all.
 *
 * The posthog-js bundle is imported dynamically after the window `load`
 * event, so analytics never competes with the fonts and first paint on a
 * slow connection (it cost ~0.5 s of LCP on simulated 4G when it loaded with
 * the page). `lib/track.ts` is the matching lazy path for custom events.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      if (cancelled) return;
      import("@/lib/posthog").then((m) => m.initPostHog());
    };
    if (document.readyState === "complete") boot();
    else window.addEventListener("load", boot, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", boot);
    };
  }, []);
  return <>{children}</>;
}
