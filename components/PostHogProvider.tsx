"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const pathname = usePathname();
  const [booted, setBooted] = useState(false);

  // Client-side navigation does not reload the page, so the recorder that
  // started on / would keep recording /me. Re-check privacy on every path
  // change once PostHog has booted (lib/posthog-privacy.ts). Before boot there
  // is nothing to stop, and importing here would pull posthog-js into
  // hydration; initPostHog checks the path it boots on by itself.
  useEffect(() => {
    if (!booted) return;
    import("@/lib/posthog").then((m) => m.syncPrivacy(pathname ?? window.location.pathname));
  }, [booted, pathname]);

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      if (cancelled) return;
      import("@/lib/posthog").then((m) => {
        m.initPostHog();
        if (!cancelled) setBooted(true);
      });
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
