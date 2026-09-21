import { track } from "./track";

/**
 * Custom PostHog events for this app's CORE ACTION (docs/analytics.md in
 * KalpKan/portfolio: 2 to 4 events, snake_case, past tense, <object>_<verb>;
 * properties are small ids/enums/counts, never free text a visitor typed).
 * Autocapture already records every click and pageview, so do not add events
 * for navigation.
 *
 * TODO when you build the app:
 *   1. Rename the example below to your core action (e.g. `pdf_parsed`,
 *      `rep_counted`, `plant_identified`; reserved names are listed in
 *      docs/analytics.md and light up the "Top demos by usage" insight).
 *   2. Add 1 to 3 more only if there are other core actions.
 *   3. Call `events.<name>(props)` from the component that performs the
 *      action (a client component; `track` is a no-op on the server and
 *      without NEXT_PUBLIC_POSTHOG_KEY).
 *   4. Record the names in the README and in the hub's
 *      skills/portfolio-ops/settings-map.md row for this app.
 */
export const events = {
  /** Example: fired when a visitor completes the thing this app is for. */
  example_action_completed: (props: { kind: string }) => track("example_action_completed", props),
} as const;
