# Brain Redesign Implementation Plan

> **For agentic workers:** this plan is executed by a Workflow (Kalp's choice). There are three
> rounds of design, then implement, then UI test and feedback, then reimplement. Sonnet (high)
> agents implement and test, and Fable 5.2 (high) agents lead and judge. Steps use checkbox
> (`- [ ]`) syntax.

**Goal:** Restyle Sift's web UI so the private radar's papers appear as a living neuron network
(fields = clusters, papers = neurons, new = firing, 👍 = stronger links), with the same visual
language on every page and paper titles still the easiest thing to read.

**Architecture:**
- A pure, deterministic network model (`lib/brain/`) turns clusters and papers into positioned
  neurons and edges.
- A server-rendered SVG component (`components/brain/BrainMap.tsx`) draws it.
- A small client hook animates spikes and hover links, and switches itself off for
  reduced motion and hidden tabs.
- Pages compose the map with the restyled list.
- A gated dev preview with fixture data lets automated testers see `/me` without Google sign-in.

**Tech Stack:** Next.js 16.3 (read `node_modules/next/dist/docs/` before writing Next code, per
AGENTS.md), React 19.2, Tailwind 4 (`@theme inline` tokens), Vitest, Playwright (dev
dependency, for screenshots only).

**Spec:** `docs/superpowers/specs/2026-11-15-brain-redesign-design.md`

## Global Constraints

- Paper titles stay the most prominent text on every list.
- Every colour is defined once per appearance in `app/globals.css` (light under `:root`, dark
  under `@media (prefers-color-scheme: dark)`). The pages follow the device setting.
- No three.js, d3-force or animation frameworks. The map's client JS is about 15 KB gzipped or
  less.
- `prefers-reduced-motion: reduce` gives a static map. New papers get a steady glow instead
  of firing.
- Animation pauses when `document.hidden` is true or the map is off screen
  (IntersectionObserver).
- No layout shift: the map reserves its height before hydration.
- The map is `aria-hidden`. Text contrast is 4.5:1 or better in both appearances, and keyboard
  focus is visible.
- Public pages (`/`, `/t/<slug>`, `/sign-in`) never read interests, ratings or follows.
  `lib/public-pages.test.ts` must stay green.
- `ph-no-capture` stays on private pages. Analytics events are unchanged.
- Fonts are system stacks or a free font self-hosted in the repo. No runtime CDN.
- Behaviour tests stay green unchanged: rating requests, `aria-pressed`, button labels, events,
  open tracking and privacy. Class-name and old-structure assertions may be rewritten.
- `npm test`, `npm run lint` and `npm run build` are green at the end of every round. Prefix
  node/npm/npx with `env -u NODE_OPTIONS` on this Mac.
- All work goes on branch `brain-redesign` in `~/projects/sift`. Nothing is pushed until Claude's
  final check. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Change to the spec's dev-preview call:** the preview is gated by
`SIFT_DEV_PREVIEW=1` **and** no `VERCEL` env, rather than by `NODE_ENV`. Testers need it under
`next start`, where `NODE_ENV` is production. On Vercel it is always 404.

## Review Focus

1. **A month-precision PubMed date** (`YYYY-MM-01T00:00:00Z`) near the start of a month must not
   make a paper fire. `isNew` uses a strict 0–48 h window, and a test pins a 1st-of-month date
   checked on the 3rd.
2. **A very long title or journal** (over 200 characters) on 390 px wraps without horizontal
   scroll and without pushing the 👍/👎 off screen. The visual check covers it with a fixture
   paper.
3. **Tapping 👍 when the request fails** rolls back the neuron state as well as the button. A
   test asserts the map's verdict attribute returns to its old value.
4. **A server and client render mismatch** from randomness or `Date.now()` in the map. Layout is
   seeded only from PMIDs and topic ids, and a test renders twice and compares.
5. **Zero followed fields, or zero papers.** The map renders the dormant network and the page
   keeps its empty-state text. A test renders with `[]`.

---

### Task 0: Branch, dev preview, screenshot harness

**Files:**
- Create: `lib/dev-preview.ts`, `lib/dev-preview.test.ts`, `lib/dev-fixtures.ts`,
  `app/dev/radar/page.tsx`, `app/dev/settings/page.tsx`, `scripts/ui-shots.mjs`
- Modify: `package.json` (devDependency `playwright`, script `"shots": "node scripts/ui-shots.mjs"`)

**Interfaces:**
- Produces: `isDevPreviewEnabled(env: Record<string, string | undefined>): boolean`.
- Produces: `DEV_RADAR_FEED: { query: string; updatedAt: string; rankerVersion: string;
  papers: MePaper[] }`. It has 10 papers across `bci`, `neural-engineering`, `dbs` and
  `stem-cells`. Three are published under 48 h before `DEV_NOW`. One has `verdict: 1`, one has
  `verdict: -1`, and one has a 220-character title.
- Produces: `DEV_NOW: Date`.
- Produces: `scripts/ui-shots.mjs --base <url> --out <dir>`. It writes PNGs for `/`,
  `/t/neuromodulation`, `/sign-in`, `/dev/radar`, `/dev/radar?empty=1` and `/dev/settings` at
  1440×900 and 390×844, in light and dark, plus `/dev/radar` with reduced motion. It also writes
  `report.json` with console errors and CLS per page.

- [ ] Write `lib/dev-preview.test.ts`:
  - `isDevPreviewEnabled({})` is false.
  - `{SIFT_DEV_PREVIEW:"1"}` is true.
  - `{SIFT_DEV_PREVIEW:"1", VERCEL:"1"}` is false.
- [ ] Run it. Expect FAIL. Implement it. Expect PASS.
- [ ] The dev pages call `notFound()` unless `isDevPreviewEnabled(process.env)`. They render the
  same components as `/me` and `/me/settings` with `DEV_RADAR_FEED`, and `?empty=1` gives zero
  papers. Rating buttons there must not hit the real API: pass a no-op rate handler, or let them
  fail into the existing "Not saved" path.
- [ ] Create the branch: `git checkout -b brain-redesign`. Commit.

### Task 1: The network model (pure)

**Files:** Create `lib/brain/network.ts` and `lib/brain/network.test.ts`.

**Interfaces:**
- Produces: `isNew(publishedIso: string, now: Date): boolean`, true iff
  `0 <= now − published <= 48 h`.
- Produces: `buildNetwork(input: NetworkInput): Network`, where:
  - `NetworkInput = { clusters: { id: string; label: string }[]; neurons: { id: string;
    cluster: string; rank: number; isNew: boolean; verdict: 1 | -1 | null }[]; width: number;
    height: number }`
  - `Network = { clusters: { id; label; x; y; r; hue: number }[]; neurons: { id; cluster; x;
    y; size; isNew; verdict }[]; edges: { from: string; to: string; kind: "dendrite" | "axon";
    d: string }[]; dormant: boolean }`

- [ ] Tests:
  - The same input gives deep-equal output.
  - Every neuron lies within its cluster's radius.
  - Neuron count equals input count.
  - With 4 clusters there are exactly 4 inter-cluster `axon` edges (a ring), and with 1 cluster
    there are 0.
  - Empty clusters give `dormant: true` with decorative neurons and no labels.
  - A lower rank gives a larger `size`.
  - `isNew("2026-11-01T00:00:00Z", new Date("2026-11-03T12:00:00Z")) === false`, and 47 h ago
    is true.
- [ ] Implement it with a string-hash PRNG seeded by ids (no `Math.random`). Edge `d` is an SVG
  cubic path with organic curvature. Commit.

### Task 2: BrainMap component and firing

**Files:**
- Create: `components/brain/BrainMap.tsx` (server-safe SVG),
  `components/brain/BrainMap.test.tsx`, `components/brain/useFiring.ts` (client),
  `components/brain/BrainHover.tsx` (client context linking rows to neurons)

**Interfaces:**
- Consumes: `buildNetwork` and `isNew`.
- Produces: `<BrainMap network={Network} variant="radar" | "hero" | "topic" | "motif"
  height={number} />`. Each neuron is `<g data-pmid data-verdict data-new>`.
- Produces: `<BrainHoverProvider>`, plus `useBrainHover(): { active: string | null;
  setActive(id: string | null): void }`.

- [ ] Tests:
  - Renders one `[data-pmid]` per neuron.
  - The root has `aria-hidden="true"` and a fixed height style.
  - Rendering twice gives identical markup.
  - `variant="hero"` renders cluster labels only.
- [ ] Firing: about one spike every 2–5 s per new neuron, at most 3 spikes on screen, travelling
  along the neuron's axon path (`stroke-dashoffset` animation or rAF). The soma pulses on
  arrival. In `hero`, the firing is ambient and seeded.
- [ ] Off for reduced motion and hidden tabs (Global Constraints). Hovering a neuron sets
  `active`, and clicking scrolls to `#paper-<pmid>`. Commit.

### Task 3: The radar page and row

**Files:**
- Modify: `app/me/page.tsx`, `components/me/RadarEntry.tsx`, `components/me/MeShell.tsx`,
  `components/me/RadarEntry.test.tsx`
- Use in: `app/dev/radar/page.tsx`

**Interfaces:**
- Consumes: BrainMap, BrainHover and `isNew`.
- Produces: `RadarEntry` gets an `id="paper-<pmid>"` anchor and a soma dot in its cluster
  colour. Hover or focus calls `setActive(pmid)`. Its verdict state is reflected on the map
  (shared via `BrainHover` context or a `data-verdict` update).

- [ ] Test: a failed rate request restores the previous verdict on both the button
  (`aria-pressed`) and the map neuron (`data-verdict`). Existing behaviour tests stay unchanged.
- [ ] 👍 thickens that neuron's edges and sends a burst. 👎 dims the neuron. Commit.

### Task 4: Tokens and the other pages

**Files:**
- Modify: `app/globals.css` (replace the "ink on paper" thesis comment with the brain thesis,
  plus light and dark tokens including 4 cluster hues and 1 spike colour), `app/page.tsx`,
  `app/t/[slug]/page.tsx`, `app/sign-in/page.tsx`, `app/me/settings/page.tsx`,
  `components/PaperEntry.tsx`, `components/Footer.tsx`, `components/me/FollowsForm.tsx`,
  `components/me/InterestList.tsx`
- Create: `docs/design/brain.md` (written by the round-1 lead; implementers follow it)

- [ ] `/` gets the hero map of public topics (names from `loadTopics()` only), `/t/<slug>` a
  topic map, `/sign-in` the motif, and settings the shared frame.
- [ ] `lib/public-pages.test.ts` and `components/*.test.tsx` are green. Commit.

### Task 5: Round QA (each round)

- [ ] `env -u NODE_OPTIONS npm test && npm run lint && npm run build` all pass.
- [ ] `SIFT_DEV_PREVIEW=1 env -u NODE_OPTIONS npx next start -p 3107`, then `node
  scripts/ui-shots.mjs --base http://localhost:3107 --out docs/images/redesign/round-N`. Expect
  zero console errors and CLS under 0.05.
- [ ] Lighthouse mobile performance on `/` is 0.9 or above (`npx lighthouse` against the local
  production server).
- [ ] The client JS added for the map is about 15 KB gzipped or less (measured from
  `.next/static` chunk sizes).

### Final (Claude, after round 3)

Re-run Task 5 independently and look at the screenshots. Then merge `brain-redesign` into
`main`, push, confirm the Vercel deploy is Ready, and smoke-test `/`, `/t/*` and `/me` live.
