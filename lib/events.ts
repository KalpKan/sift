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
   * A visitor opened a paper from a feed. This is the ONLY event Sift defines,
   * and it is the only one worth defining: it is the single observation that
   * says the ranking did its job. `rank` is the position it was shown at, so
   * "are the top three actually the ones people open?" is answerable — which
   * is the same question docs/eval/ asks offline.
   *
   * Navigation is not here on purpose: autocapture already records pageviews.
   */
  paper_opened: (props: { topic: string; rank: number }) => track("paper_opened", props),
} as const;
