# Sift redesign: the brain is the radar

Date: 2026-11-15. Asked for by Kalp, the owner and only reader of the private radar.

## Intent

Sign-in works and Kalp is about to start using `/me` daily, tapping 👍/👎 to teach the ranking.
He asked for the site to be beautified "in the design of a brain, with different neurons and
firing patterns, while still being clean". It is his research radar for BCI, neural engineering,
DBS and stem cells, and it is also a portfolio piece on kalpkan.com, so it should look like the
work of someone who wants to be a neurotech physician-scientist.

The current look (`app/globals.css`, "ink on paper", a printed table of contents with no colour
or motion) is retired. Its one rule that survives: **paper titles are still the easiest thing on
the page to read.**

## Goals

1. The brain carries meaning, not just decoration (Kalp picked approach B, below).
2. Clean: the list of papers stays calm, aligned and scannable. The animation lives in one place
   (the network map) and is sparse.
3. Follows the device's light/dark setting (Kalp's pick). Both appearances are designed: glowing
   neurons on near-black in dark mode, ink-drawn neurons with coloured spikes on warm off-white in
   light mode.
4. Every page shares the language: `/`, `/t/<slug>`, `/sign-in`, `/me`, `/me/settings`.

## Non-goals

- The iOS app and widget (Phase 4) are not touched.
- No change to the ranking, the API, the database, auth or analytics.
- No 3D, no WebGL, no anatomically correct brain illustration.

## Anti-goals (a failure even if it works)

- Titles harder to read than today, or the list turned into cards/tiles that hide them.
- Constant busy motion: a screensaver behind the content. Firing must be rare enough to notice.
- A slow page: animation that drains a phone battery or keeps running in a hidden tab.
- Anything personal (interests, ratings, followed fields) rendered on a public page.
- Generic "AI glow" styling: neon gradients everywhere, glassmorphism, purple-to-blue washes.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | Living brain background: a sparse neuron field with random action potentials behind the existing list | Cheapest and safest, but the firing means nothing |
| **B** | **The brain is the radar: fields are neuron clusters, papers are neurons, new papers fire, 👍 strengthens a link** | **More work, but every pulse is real information. Picked by Kalp.** |
| C | Every paper drawn as a neuron in a branching tree | Most literal, busiest, and titles get harder to scan |

## The design (B)

### The network map (top of `/me`)

```
┌──────────────────────────────────────────────┐
│  Sift · My radar                    settings │
│     BCI ●──●            ● DBS                │
│        ╲  ● ⚡ ───────●╱  ●                   │
│   ●─────●     neural eng ●──●                │
│  stem cells ●──●   ⚡→→→●                     │
├──────────────────────────────────────────────┤
│ 1 ● Closed-loop DBS for tremor…      👍 👎    │
│     Brain Stimulation · 2 d · DBS            │
│ 2 ● iPSC-derived dopaminergic…       👍 👎    │
└──────────────────────────────────────────────┘
```

- **Clusters = the fields he follows.** Each followed topic is a labelled cluster with its own
  colour. The label is always text, so colour never carries meaning alone.
- **Neurons = today's papers.** Each of the top-10 papers is a soma in its topic's cluster. Rank
  sets size and brightness. Position is deterministic from the PMID (seeded), so the server
  render and the client render match and the map is stable between visits.
- **Wiring.** Dendrite-like curves connect neurons inside a cluster, and a few long axons connect
  clusters. Curves are organic, not straight graph edges.
- **Firing = new.** Papers published in the last 48 hours fire: an action potential travels along
  their axon and the soma pulses. At most a few spikes are on screen at once, with seconds of rest
  between them. Older papers rest.
- **Linked to the list.** Hovering or focusing a paper row lights its neuron and sends one spike
  to its cluster label. Hovering a neuron highlights its row, and clicking it scrolls to the row.
- **👍 / 👎 are visible in the brain.** 👍 sends a burst from that neuron and thickens its
  connections, which stay thicker while the rating stands. 👎 dims the neuron. It reads from the
  real `verdict`, so a reload shows the same state.

### The list

The same information as today: rank, title, meta, reasons, 👍/👎. Each row gains a small soma dot
in its cluster colour next to the rank, and the topic name in the meta line. Titles stay serif and
largest. Rows are separated by quiet rules, not cards. Rating buttons get clear pressed states.

### Other pages

- **`/` (public):** a calmer hero map whose clusters are the public topics, with ambient firing
  only. It reads only public data: never interests, ratings or follows. The intro copy and the
  live neuromodulation feed stay.
- **`/t/<slug>`:** a small single-cluster map in the header, then the list in the shared style.
- **`/sign-in`:** a small network motif around the Google button.
- **`/me/settings`:** the same frame. Follows and interests in the shared style. No map needed.

### Motion and performance rules

- `prefers-reduced-motion`: the map renders static. New papers are marked with a steady glow
  instead of firing.
- Animation pauses when the tab is hidden or the map is scrolled off screen.
- No heavy libraries (no three.js, d3-force or animation frameworks). Hand-written SVG or canvas
  with requestAnimationFrame. The map script should stay small, roughly 15 KB gzipped or less.
- Lighthouse mobile performance on `/` stays at 0.9 or above, with no layout shift from the map
  (it reserves its height).
- The map is `aria-hidden` decoration. The list is the accessible source of truth. Text contrast
  is at least 4.5:1 in both appearances, and keyboard focus is visible.

## Constraints

- Next.js 16.3, React 19.2, Tailwind 4 (`@theme inline` tokens in `app/globals.css`). Keep the
  token approach: every colour is defined once for light and once for dark.
- Fonts: system stacks or a free, self-hosted font. Nothing fetched from a CDN at runtime.
- Privacy layers stay intact: `ph-no-capture` on private pages, and `lib/public-pages.test.ts`
  must keep passing (public pages render nothing personal). Analytics events are unchanged.
- All existing tests keep passing (`npm test`, `npm run lint`, `npm run build`). Tests whose
  assertions are about the old visual thesis may be updated. Tests about behaviour may not.
- `/me` needs a Google sign-in, which automated testers do not have. A **dev-only preview** of
  the radar with sample papers is added for visual testing. It returns 404 in production builds,
  and a test proves that.

## How it gets built (Kalp's instructions)

A Workflow runs **three rounds** of design → implement → UI test and feedback → reimplement.
**Sonnet agents (high effort)** do the implementing and the UI testing. They report to **Fable 5.2
agents (high effort)**, who write the design direction, judge the screenshots and feedback, and
decide what the next round fixes. Testers take screenshots at 1440 px and 390 px, in light, dark
and reduced motion, and check console errors, contrast, layout shift, Lighthouse and the test
suite. Work happens on branch `brain-redesign`. After round 3, Claude verifies the result itself,
then merges to `main`, which deploys to sift.kalpkan.com.

## Calls settled after the builder check (Claude's calls, not Kalp's)

- **Scope and order.** All five pages are in scope. The shared map engine and `/me` come first in
  round 1, then the other pages follow in that round with the same engine.
- **Thin radar.** One followed field means a one-cluster map. If no fields are followed, the map is
  a faint, dormant, unlabelled network above the existing "follow a topic" empty state. Fewer than
  10 papers means fewer neurons.
- **"New" means** `published` within 48 hours of now, the same rule the iPhone feed uses. If a
  PubMed date is only month-precise, it is not treated as new.
- **One neuron per listed paper**, in the cluster of its `topic` field (the field that ranked it
  highest). The map and the list always show the same set. When a rating changes, the neuron's
  state changes but the set does not until the next reload.
- **Wiring is decorative.** It is seeded from PMIDs. Long axons link neighbouring clusters in a
  ring. 👍 thickens only that neuron's own connections.
- **Public `/` map.** Clusters are the real public topics (names only). Ambient firing is seeded
  and random, and does not claim to be data. It is server-rendered SVG, with the animation
  starting after hydration.
- **Tests.** Behaviour tests are rating requests, `aria-pressed`, button labels, analytics events,
  open tracking and the public-page privacy test. They must keep passing unchanged. Assertions
  on class names or the old visual structure may be rewritten.
- **Dev preview** lives at `/dev/radar` and calls `notFound()` when `NODE_ENV === "production"`.
  A test covers that. Branch `brain-redesign` is cut from a clean `main`.

## Left to the builder

The exact palette (four cluster colours plus the spike colour, per appearance), the layout
algorithm for clusters, SVG versus canvas, the spike timing, the type scale, and the copy tweaks
needed to fit the new layout.
