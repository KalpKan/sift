import { track } from "./track";

/**
 * Custom PostHog events for Sift's core action (KalpKan/portfolio
 * docs/analytics.md: 2 to 4 events, snake_case, past tense, <object>_<verb>).
 * Autocapture already records every click and pageview, so nothing here is
 * about navigation.
 *
 * A NOTE ON WHAT WE DELIBERATELY DO NOT MEASURE: the iOS widget cannot tell us
 * it was looked at. WidgetKit has no impression, visibility or on-screen
 * callback of any kind (docs/widget-constraints.md #2). So there is no
 * "paper_seen" event and there never will be one — any engagement number we
 * reported would be invented. Taps are real events; views are not.
 */
export const events = {
  /**
   * A visitor opened a paper from a feed. Until the private radar this was the
   * only event Sift defined, and the only one worth defining: it is the single observation that
   * says the ranking did its job. `rank` is the position it was shown at, so
   * "are the top three actually the ones people open?" is answerable — which
   * is the same question docs/eval/ asks offline.
   *
   * Navigation is not here on purpose: autocapture already records pageviews.
   */
  paper_opened: (props: { topic: string; rank: number }) => track("paper_opened", props),

  /**
   * The same event from the private radar (/me). PMID only: the radar is
   * personal, so nothing that could describe what Kalp reads or thinks about
   * (a title, a topic of his, an interest term) is ever sent to analytics.
   */
  radar_paper_opened: ({ pmid }: { pmid: string }) => track("paper_opened", { pmid }),

  /** A thumbs-up (1) or thumbs-down (-1) on the radar. PMID and verdict only. */
  paper_rated: ({ pmid, verdict }: { pmid: string; verdict: 1 | -1 }) => track("paper_rated", { pmid, verdict }),
} as const;
