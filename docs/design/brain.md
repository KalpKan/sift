# Sift design direction: a plate of cortex

Round-1 direction for the brain redesign. Spec: `docs/superpowers/specs/2026-11-15-brain-redesign-design.md`.
Plan: `docs/superpowers/plans/2026-11-18-brain-redesign.md`. This file settles everything the spec
left to the builder. If it and the plan disagree on a visual matter, this file wins. On behaviour,
privacy and tests, the plan wins.

## Round 3 changes (lead's call after judging round 2)

Round 2 landed the direction. Titles are loudest, both appearances are designed, and the states
read. Round 3 is the last build round, so it removes what looks wrong and adds nothing. Everything
below is folded into the sections that follow. Where this file and the round-2 code disagree, this
file wins.

1. **Two-row maps lose the commissures.** On a phone they were two long, parallel, nearly straight
   lines and the hero read as a table with column rules. Each row is now its own slab with its own
   U's, and nothing joins the rows. The two-row box grows from 292 to 300 px so the bottom label
   has room (§5).
2. **Cells keep clear of each other.** Rings never overlap, and no soma sits on another cell's
   fibre. Round 2 stacked ranks 1 and 2 on the phone radar into one smudge and put the 👎 cell on
   the fibre bundle (§5).
3. **A single field uses the width.** One cluster spreads to about 380 px of the 608 px figure
   (about 230 of 350 on a phone) instead of a knot in the middle (§5).
4. **A date never breaks across two lines** (§7).
5. **The sign-in button sits on the column's left edge** and is as wide as the motif above it. The
   motif is drawn a little larger (§5, §8).
6. **The follow checkboxes are drawn by us,** so the unchecked one is no longer a bright white
   square in dark mode. `color-scheme` is declared (§2, §8).
7. **The unpressed rating glyph is lighter in light mode** (3.0 to 3.6:1, was 4.3:1), so ten pairs
   of buttons stop competing with the titles (§7).
8. **Small tidying:** the footer rule stops at the column, and a public row on a phone puts its
   score on the reasons line (§7, §8).
9. **Interests stay exactly as they are.** Kalp repeated it for round 3: nothing more goes into
   that section.

## Round 2 changes (lead's call after judging round 1)

The direction holds: a plate of cortex, still by default, titles loudest. Round 1 was too timid
with it, so round 2 changes numbers, not the idea. Everything below is already folded into the
sections that follow. Where this file and the round-1 code disagree, this file wins.

1. **The figure gets presence.** Radar wide scale 1 → 1.25 (1.1 with five or six fields), hero wide
   0.9 → 1.0, radar compact 0.8 → 0.9 in a 184 px box. Clusters become ellipses so a thin radar
   spreads out (§5).
2. **Dark mode has to glow, light mode has to hold a line.** `--wire` is lifted in both
   appearances, fibres and dendrites are more opaque, the dark halo is stronger, and a 👎 cell
   stays visible (§2, §4).
3. **A new token, `--control`,** gives the rating buttons a border that passes 3:1, and the
   unpressed glyph is darkened in light mode (§2, §7).
4. **Two-row layouts lose the side loops.** They ran through the labels. Round 2 joined the rows
   with commissures instead. Round 3 removed those too (§5).
5. **The topic map becomes a real figure:** full width, in the figure frame, with a caption, cells
   in rank order left to right (§5, §8).
6. **The sign-in motif is centred on the button** it plugs into (§8). Round 3 keeps that and moves
   the button to the column edge.
7. **Row polish:** a fixed rank column so dots line up, the topic name wraps as one unit, "1 weeks
   old" is shown as "1 week old", the rating footnote hides when there are no rows (§7, §8).
8. **Interests on a phone** stack onto two tidy lines. Nothing is added to that section (§8).

Reference sketch (static, nothing moves): `brain-reference.html`, rendered as
`brain-reference-light.png` and `brain-reference-dark.png` in this folder. The HTML holds a working
copy of the seeded generator with the round-1 numbers. It is a sketch of the idea only: the numbers
in this file have moved on from it.

## 1. Visual thesis

Sift is a page from a neuroanatomy atlas: one small figure of cells at the top, drawn in ink like a
Cajal plate in light mode and seen under fluorescence in dark mode, and under it a ruled list where
paper titles are the largest and darkest thing. Each field is a group of one cell type, each paper
is one cell, and the only thing that ever moves is a short spike running down the axon of a paper
that is new.

Three rules follow from that:

1. **Anatomy is cool, events are warm.** The four cluster hues are cool or neutral. The two warm
   colours mean something happened: vermilion is a spike (new), gold is reinforcement (👍).
2. **Still by default.** The server render is a complete, correct, motionless figure. Motion is
   added by the client and is never needed to read the state.
3. **The figure is a figure.** It sits in the text column between two rules with a one-line
   caption, like a figure in a paper. It is not a background and nothing is drawn behind text.

## 2. Colour tokens

Defined once per appearance in `app/globals.css` (`:root` and
`@media (prefers-color-scheme: dark)`), then exposed through `@theme inline` as `--color-*`.
The six existing token names keep their names. `:root` also declares `color-scheme: light dark`, so
native controls and scrollbars follow the appearance.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#f9f7f2` | `#0e0f11` | Page background |
| `--surface` | `#f1eee6` | `#17191c` | Row highlight, button hover |
| `--surface-strong` | `#e7e3d8` | `#212429` | Pressed 👎 button. Never behind text |
| `--ink` | `#1b1916` | `#ece9e2` | Titles, headings, focus ring |
| `--ink-muted` | `#524e47` | `#aaa69d` | Meta line, prose asides |
| `--ink-faint` | `#6b675f` | `#8d8980` | Reasons, rank, score, nav, captions |
| `--rule` | `#e1ddd2` | `#26282c` | Hairline between rows, button border |
| `--rule-strong` | `#1b1916` | `#5d6067` | Rule under a heading, top of the figure |
| `--cell` | `#2b2824` | `#6a6d73` | Dendrites and fibres in light mode. Dark mode draws them in the cluster hue, so the dark value is only a fallback |
| `--wire` | `#a39d8f` | `#565a62` | Tracts between clusters, dormant cells. 2.52:1 and 2.77:1 on paper (round 1 was 1.97 and 1.79, too faint) |
| `--control` | `#8a857a` | `#62656c` | Border of an unpressed rating button. 3.43:1 and 3.28:1 on paper, 3.17 and 3.02 on surface. Never text |
| `--cluster-1` | `#2b5b96` | `#82b1ea` | Blue. Pyramidal cells |
| `--cluster-2` | `#17696f` | `#5ec6c0` | Teal. Stellate cells |
| `--cluster-3` | `#2e6e3f` | `#84cf8e` | Green. Purkinje cells |
| `--cluster-4` | `#8a3c76` | `#e08fc6` | Plum. Bipolar cells |
| `--spike` | `#c2361a` | `#ff7a55` | Spike, "new" ring, the word "new" |
| `--reinforce` | `#8a5d00` | `#f0c14b` | 👍 ring, thickened fibre, pressed 👍 border |
| `--reinforce-wash` | `#e7decb` | `#322b1a` | Pressed 👍 button fill. Never behind text |

Contrast of every text colour, computed with the WCAG formula. Text only ever sits on `--paper` or
`--surface`.

| Text colour | Light on paper | Light on surface | Dark on paper | Dark on surface |
|---|---|---|---|---|
| `--ink` | 16.38 | 15.13 | 15.82 | 14.53 |
| `--ink-muted` | 7.72 | 7.13 | 7.90 | 7.26 |
| `--ink-faint` | 5.26 | 4.86 | 5.50 | 5.05 |
| `--cluster-1` | 6.45 | 5.96 | 8.61 | 7.91 |
| `--cluster-2` | 5.97 | 5.51 | 9.42 | 8.65 |
| `--cluster-3` | 5.74 | 5.30 | 10.32 | 9.48 |
| `--cluster-4` | 6.56 | 6.06 | 8.14 | 7.48 |
| `--spike` | 5.11 | 4.72 | 7.46 | 6.85 |
| `--reinforce` | 5.38 | 4.97 | 11.35 | 10.43 |

The old `--ink-faint` failed 4.5:1 (3.51 in light, 3.61 in dark). The new one passes, so do not
lighten it. Do not set text on `--surface-strong` or `--reinforce-wash`: `--ink-faint` drops to
4.39 (light) and 4.46 (dark) on `--surface-strong`, and light `--spike` to 4.27.

**Hue assignment.** A cluster's hue and its cell type are both `index mod 4`, where `index` is the
cluster's position in that map's cluster list. On `/me` the list is the followed topics in
`listTopics()` order. On `/` it is `loadTopics()` order. On `/t/<slug>` the single cluster takes
the index that slug has in `loadTopics()` order (fall back to 0 if topics fail to load), so a topic
has the same colour on `/` and on its own page. With six public topics, the fifth and sixth reuse
blue and teal. That is fine: the label is always text.

## 3. Type

System stacks only. No web font, so no fetch and no shift. Keep the three stacks already in
`globals.css`:

- `--font-serif`: `ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif`
- `--font-sans`: `ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- `--font-mono`: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

Serif is for things you read (titles, headings, prose). Sans is for things about them (meta,
reasons, nav, buttons, map labels). Mono is for numbers and instrument readouts (rank, score,
figure caption, the query, the footer). All weights are 400 unless stated.

| Role | Face | 640 px and up | Under 640 px | Colour |
|---|---|---|---|---|
| Wordmark (`/` h1) | serif | 44 / 1.05, −0.01em | 36 / 1.1 | ink |
| Page title (other h1) | serif | 34 / 1.1, −0.01em | 28 / 1.15 | ink |
| **Paper title** | serif | **20 / 1.3** | **18 / 1.32** | ink |
| Lead prose | serif | 19 / 1.6 | 18 / 1.55 | ink, second paragraph ink-muted |
| Section heading (h2) | serif | 18 / 1.3 | 17 / 1.3 | ink |
| List item name (topic, interest term, checkbox label) | serif | 17 / 1.35 | 17 / 1.35 | ink |
| Meta | sans | 13 / 1.45 | 13 / 1.45 | ink-muted |
| Small (reasons, nav, helper, footnote) | sans | 12 / 1.4 | 12 / 1.4 | ink-faint |
| Data (rank, score) | mono, tabular | 12 / 1.3 | 12 / 1.3 | ink-faint |
| Caption, footer | mono | 11 / 1.3 | 11 / 1.3 | ink-faint |
| Map label | sans 600 | 11 | sans 500, 10 | cluster hue |

Section headings drop from 24 px to 18 px on purpose. Inside any list, nothing is larger than a
paper title. Only the page's own h1 is bigger.

Keep `font-variant-numeric: oldstyle-nums` on body and `.tabular` for rank and score.

## 4. The neuron

Every cell has the same four parts. "Up" is toward the top of the figure.

- **Soma.** A filled shape in the cluster hue. Radius `rs = (7 − 0.4 × (rank − 1)) × scale`, so rank
  1 is 7 px and rank 10 is 3.4 px at scale 1 (8.75 px and 4.25 px on the wide radar, scale 1.25). Opacity `1 − 0.035 × (rank − 1)` on the whole cell
  (1.0 down to 0.685). Bigger and stronger means ranked higher.
- **Dendrites.** Thin curved strokes rising from the soma, round caps. Trunks are 1 px, branches
  0.75 px. Every segment is a quadratic curve bent sideways by up to ±14% of its length. Light:
  `--cell` at 0.78 opacity. Dark: the cluster hue at 0.75.
- **Fibre (the axon).** One 0.75 px stroke from the bottom of the soma down to the cluster's
  **hub**, a point below the cluster where all its fibres meet. Light: `--cell` at 0.5. Dark: hue
  at 0.68. This is the path a spike travels. The hub itself is not drawn.
- **Halo (dark mode only).** Two flat discs under the soma in the cluster hue: radius `1.8 × rs` at
  0.20 opacity and `2.7 × rs` at 0.10. No blur filter, no gradient.

The four cell types, one per hue slot. Lengths are multiples of `rs`. Angles are degrees from
straight up. `maxUp = y − rs − 6` keeps every dendrite inside the figure.

| Slot | Type | Soma | Dendrites |
|---|---|---|---|
| 1 | Pyramidal | Rounded triangle, apex up: points (0, −0.95), (±0.8, +0.55), drawn with a 0.55 round-joined stroke in the fill colour | One apical trunk, length min(5, maxUp), leaning ±7°. Two tuft branches at its tip, 24–40° each side, length 1.6. One oblique branch at 55% up the trunk, 48–62° to one side, length 1.5. Two basal dendrites at ±(113–137°), length 2.2, each ending in a 1.0 twig |
| 2 | Stellate | Circle | Five dendrites spaced 72° apart from a seeded start angle, ±14° jitter, kept out of the downward 155–205° cone. Length 2.2–3.0. Each forks at 60% of its length, 28–42° to one side, length 1.1 |
| 3 | Purkinje | Circle | Two trunks at ±(16–28°), length 2.2. Each splits into two branches (22–34° either side, 1.7), and each of those into two twigs (18–30°, 1.2). A flat fan |
| 4 | Bipolar | Upright ellipse, 0.8 wide by 1.2 tall | One dendrite straight up, length 3.4, leaning ±6°, ending in a two-branch tuft (24–36°, 1.2). Nothing else |

In compact layouts (`detail: 1`) drop the last level: no oblique branch or basal twigs on
pyramidal cells, only every other stellate dendrite forks, no Purkinje twigs.

Put each cell's 1 px strokes in one `<path>` and its 0.75 px strokes in another, so a cell is about
eight elements. Every random choice comes from a PRNG seeded with the neuron id (PMID). No
`Math.random`, no `Date.now`.

**States.** All of them are visible in the server render and do not depend on motion.

| State | Source | What it looks like |
|---|---|---|
| Resting | default | As above |
| New | `data-new="true"` | A 1.25 px ring in `--spike` at radius `rs + 3.5`. Always there, moving or not |
| 👍 | `data-verdict="1"` | The fibre becomes 1.75 px in `--reinforce` at 0.9 opacity. Dendrite widths × 1.6. A 1.25 px `--reinforce` ring at `rs + 3.5` (at `rs + 6.5` if the cell is also new, so both rings show) |
| 👎 | `data-verdict="-1"` | Whole cell at 0.5 opacity. Soma hollow: `--paper` fill, 1.25 px hue outline. No halo, no new ring, and it never fires. It must still read as a cell, so a field whose only papers are 👎 does not look empty |
| Dormant | no clusters | Everything in `--wire`: soma, dendrites, fibres. No hue, no halo, no label, no motion |

## 5. Cluster layout

The composition is a slab of cortex. Clusters stand in a row. Cells sit in the upper part with
dendrites reaching up. Fibres run down to a level line of hubs. Tracts link the hubs. Labels sit
under the hubs, so a spike always travels toward its field's name.

**Geometry of one row.** For `n` clusters in a row of width `W`:

- column width `cw = W / n`. Cluster centre `x = cw × (i + 0.5)`,
  `y = top + rMax ± 5` (minus for even index, plus for odd, no stagger when `n = 1`).
- a cluster is an ellipse: `rx = min(0.36 × cw, 2.2 × rMax)`, `ry = min(rx, rMax)`. Soma centres
  are placed inside it, shrunk by `rs` on both axes. Two exceptions, both on the radar:
  - **one cluster alone** (`n = 1`): `rx = min(0.42 × cw, 3.4 × rMax)`. That is 190 on the wide
    radar (a 380 px spread in the 608 px figure) and 115.6 on the compact one (231 of 350). Round 2
    left ten cells in a 246 px knot with crossing dendrites.
  - **compact radar, two to four clusters:** `rx = 0.42 × cw` (36.75 with four), so a busy column
    has room to keep its rings apart.

  `ry` is unchanged, so no box grows.
- hub at `(x, top + 2 × rMax + hubGap)`. All hubs in a row share one y.
- placement: in rank order, uniform in the ellipse. A spot is rejected if it breaks either rule:
  - **rings stay apart.** Every cell has an extent `ext = rs + 4.5`, or `rs + 7.5` if it is new
    (room for the gold ring at `rs + 6.5`, since any cell can be 👍'd later). Two centres are at
    least `ext_a + ext_b + 2` apart. This replaces the round-2 `2.8 × rs + 4`.
  - **no soma on a fibre.** The new soma's centre is at least `rs + 4` from every placed cell's
    fibre, and the new cell's own fibre passes at least `rs_other + 4` from every placed soma
    centre. Sample each fibre at 16 points or more. This is what keeps one cell from standing
    directly under another, and keeps a hollow 👎 cell from reading as a knot on the bundle.

  After every 30 failures shrink both clearances by 15%. Stop at 300 tries and keep the candidate
  that had the largest worst clearance, not the last one drawn. The phone rule (real cells 28 px
  apart where there is room) stays. In the topic fan the x slot is fixed, so only the seeded `y`
  is redrawn (up to 20 tries) against the same two rules.
- a unit test on `buildNetwork` pins this for the fixtures (the default four fields, `fields=6`,
  `fields=1`, the hero and the topic fan, wide and compact): no two extents overlap, and no soma
  centre is within `rs + 2` of another cell's fibre. `fields=1` puts ten cells on one hub, so it
  alone may have up to two soma-on-fibre hits. Extents still may not overlap there.
- fibre: from the soma's bottom point, `C (x ± 5, sy + 0.45 × (hubY − sy))`
  `(hubX + 0.18 × (x − hubX), hubY − 22 × scale)` `(hubX, hubY)`.

**Tracts.** These are the plan's `kind: "axon"` edges, 1 px in `--wire`. Join consecutive hubs, and
if `n ≥ 3` close the ring from the last to the first. So 1 cluster has 0, 2 have 1, 3 have 3,
4 have 4.

- neighbours in a row: a shallow U. Control points at 30% and 70% of the span, 14 px below the hubs.
- the closing edge of a single row: a long arc under the U's. Control points at 12% and 88% of the
  span, `arc` px below the hubs. It passes between the U's and the labels.
- between rows (compact, two rows): **nothing.** No side loops, no closing arc and no
  commissures. Round 1 bowed the ring out to `x = 0` and `x = W` and it ran through the outer
  labels. Round 2 dropped a commissure through each label gap, and the gap is too narrow for a
  real bend, so the hero got two parallel 130 px lines that read as table column rules. Each row
  is now one slab with its own U's: six clusters have 4 U's, five have 3, four have 2 (3 + 1).
  Both rows use the same column grid, left to right. Delete the commissure code and its tests,
  do not hide it.

**Tract clearance (all layouts).** No tract comes within 6 px of any label's box. A unit test on
`buildNetwork` samples every tract path and checks it against the label boxes for the six public
topic names and the four fixture names, in every layout.

The plan's `kind: "dendrite"` edges are the fibres: one per neuron, `from` the neuron id, `to` its
cluster id. There are no neuron-to-neuron edges. The dendrites drawn on a cell are part of the
glyph, not edges.

**Labels.** SVG `<text>`, centred on the cluster's x, in the cluster hue. If the label is longer
than `floor((cw − 10) / charW)` characters (`floor((cw − 28) / charW)` in a two-row layout, which
keeps neighbouring labels well apart), break it into two lines at the last space or hyphen
that fits (line step = font size + 2). A single long word stays on one line.

**Layout numbers.** Two layouts are built on the server for every map: `wide` (shown at 640 px and
up) and `compact` (shown below). Each is its own `<BrainMap>` with its own fixed height, one inside
`hidden sm:block`, the other inside `sm:hidden`. The SVG has `viewBox="0 0 W H"`, `width: 100%`,
`height: 100%` and the default `preserveAspectRatio`, so it never scales up past its design size
and the box never changes height.

| Variant | Layout | W × H | Clusters per row | scale | detail | rMax | top | hubGap | arc | Label gap, size, charW |
|---|---|---|---|---|---|---|---|---|---|---|
| `radar` | wide | **608 × 232** | up to 6 | **1.25** (1.1 with 5–6 clusters) | 2 | 56 | 34 | 16 | 40 | 46, 11 px, 6.1 |
| `radar` | compact, 1–4 clusters | **350 × 184** | up to 4 | **0.9** | 1 | 34 | 30 | 14 | 36 | 42, 10 px, 5.7 |
| `radar` | compact, 5–6 clusters | **350 × 300** | 3 | 0.8 | 1 | 34 | 26 | 12 | none | 24, 10 px, 5.5 |
| `hero` | wide | **608 × 192** | up to 6 | **1.0** | 2 | 40 | 30 | 14 | 40 | 46, 11 px, 6.1 |
| `hero` | compact | **350 × 300** | 3 | 0.8 | 1 | 34 | 26 | 12 | none | 24, 10 px, 5.5 |
| `topic` | wide | **608 × 120** | 1 | 1.1 | 2 | 28 (rx 200) | 34 | 16 | none | no label |
| `topic` | compact | **350 × 104** | 1 | 0.9 | 1 | 24 (rx 140) | 30 | 14 | none | no label |
| `motif` | both | **220 × 112** | 1 | **1.3** | 2 | 32 (rx 70) | 30 | 14 | none | no label |

Map labels are sans 600 in both layouts (compact was 500 in round 1 and read thin on a phone).
If a scale change makes a dendrite or a two-line label touch the edge of its box, shrink `rMax`
by a few px. Do not grow the box past these heights. Two-row layouts step 142 px per row, and
their box is 300 px (round 2 was 292): the extra 8 px goes under the bottom row's labels, so a
two-line label ends at least 12 px above the figure's bottom hairline. "Label gap" is the distance from the hub line down to the
first label baseline. At 1440 px the map is the 608 px column. At 390 px the column is 350 px.

What each variant shows:

- **`radar`** (`/me`, `/dev/radar`). One cluster per followed topic, one cell per listed paper in
  the cluster of its `topic`. A followed topic with no paper today still gets its label and two
  dormant-style cells (ranks 3 and 7, `--wire`, no `data-pmid`), so the column is never empty.
  No followed topics at all: the dormant map, three unlabelled clusters of two cells each, same
  height.
- **`hero`** (`/`). One cluster per public topic. Three decorative cells each, sized as ranks 2, 5
  and 8, seeded from the slug. No `data-pmid`, no rings, no states. Labels only.
- **`topic`** (`/t/<slug>`). One unlabelled cluster of that page's top 8 papers, drawn as a wide,
  shallow fan across the whole column so it reads as a ranking. This variant sets `rx` itself (200
  wide, 140 compact) and takes `ry` from `rMax`, instead of using the `2.2 × rMax` rule. Cell `k` (rank 1 to 8, left to
  right) sits at `x = W/2 + rx × ((2k − 1)/8 − 1)` with ±6 px seeded jitter, `y` seeded inside
  the ellipse, sizes from the usual rank formula. All eight fibres run to one hub at the bottom
  centre. A paper published in the last 48 hours gets the new ring and fires. That is public data.
  Round 1 drew this as a 110 px bouquet floating beside the title. It had no frame, no caption
  and no meaning. It now sits in the figure frame like every other map (§8).
- **`motif`** (`/sign-in`). One unlabelled cluster of three decorative cells (ranks 2, 5, 7) in
  slot 1, at scale 1.3 with its own `rx` of 70, so the three cells span about 130 px of the 220 px
  box and read as a figure, not a doodle on the button. Its hub sits on the bottom edge of the SVG, at the SVG's horizontal centre, and that point
  touches the top centre of the button (§8).

## 6. Motion

Each cell type has its own firing pattern. This is the "different neurons and firing patterns" Kalp
asked for.

| Type | Pattern | One event |
|---|---|---|
| Pyramidal | Regular spiking | 1 spike |
| Stellate | Fast spiking | 2 spikes, 140 ms apart |
| Purkinje | Complex spike | 3 spikes, 110 ms apart |
| Bipolar | Slow | 1 spike at 0.7 × speed |

**A spike** is a dash on the cell's fibre, travelling from the soma to the hub. This order replaces
the plan's "pulses on arrival": an action potential starts at the cell body.

- Dash: 12 px long, 2.25 px wide (2 px compact), round caps, `--spike`. In dark mode add a second
  dash under it, 6 px wide at 0.22 opacity.
- Speed: 170 px/s, linear. Clamp the trip to 380–900 ms. Fade in over the first 60 ms and out over
  the last 100 ms.
- At the start the soma scales 1 → 1.3 → 1 over 260 ms (ease-out), and a copy of the new ring grows
  from `rs + 3.5` to `rs + 9` while fading 0.9 → 0 over 420 ms. The static ring stays put.
- Nothing happens at the hub. The spike does not continue along the tract.

**Rest.** One firing event at a time per map.

- `radar` and `topic`: only cells with `data-new="true"` and no 👎 fire. After an event ends, wait
  3–7 s, then fire the next candidate. A cell rests at least 8 s between its own events and never
  fires twice in a row if another candidate exists. No new papers means no ambient motion at all.
- `hero`: any cell may fire. Wait 4–9 s between events. Sequence from a PRNG with a fixed seed,
  started after hydration.
- `motif`: one single spike every 6–10 s.
- **At most 3 dashes on screen in a map, ever.** A Purkinje event uses all three.

**Hover link (radar only).**

- Row hovered or focused within: its cell's soma scales to 1.2 in 120 ms, its fibre goes to full
  opacity and +0.5 px, its cluster label turns `--ink`, every other cell drops to 0.45 of its
  opacity over 150 ms. One single spike runs down its fibre, at most once per 1.2 s per cell, and
  it is skipped if 3 dashes are already on screen. Everything restores in 200 ms on leave.
- Cell hovered: same highlight on the cell, and its row gets a `--surface` background that bleeds
  12 px left and right (`box-shadow: -12px 0 0 var(--surface), 12px 0 0 var(--surface)`), so text
  does not move.
- Cell clicked or tapped: scroll `#paper-<pmid>` to the centre of the viewport and keep the row
  highlight for 1.6 s. The hit area is an invisible circle. Wide: radius `max(rs + 6, 14)`. Compact:
  `clamp(14, d / 2, 22)`, where `d` is the distance to the nearest other real soma (22 if the cell
  is alone), so targets grow to a thumb where there is room and never overlap. Draw the hit circles
  after all cells, lowest rank last, so rank 1 wins any tie.

**👍 burst.** On press, optimistically: three dashes in `--reinforce`, 90 ms apart, at 220 px/s. The
soma scales 1 → 1.45 → 1 over 320 ms. The gold ring scales in from 0.6 over 240 ms. The fibre and
dendrites thicken over 400 ms. It cancels ambient dashes if it needs the room. If the request
fails, the cell returns to its previous state in 200 ms with no burst (Review Focus 3). A reload
shows the thick state with no burst.

**👎 dim.** The cell fades to its 👎 state over 300 ms. No other motion.

**Reduced motion, and before hydration.** The server render already carries a **steady glow** on
new cells: a filled disc of radius `rs + 7` in `--spike`, at 0.14 opacity in light and 0.22 in
dark, under the soma and its ring. When the client starts the firing scheduler it sets `is-live`
on the map root, and CSS hides the glow disc. Under `prefers-reduced-motion: reduce` the scheduler
never starts, so the glow stays. In that mode there are no spikes, bursts, pulses or scaling.
Hover changes opacity and colour instantly, 👍 and 👎 switch state instantly, and scrolling is not
smooth. Listen for the media query changing.

**Battery.** Spikes are one-shot animations (Web Animations API or a CSS keyframe on
`stroke-dashoffset`) started by a timer. There is no `requestAnimationFrame` loop while the map is
resting. Clear the timer and cancel running animations when `document.hidden` is true or when an
IntersectionObserver (threshold 0.15) says the map is off screen. A `display: none` layout never
intersects, so only the visible one of the two layouts runs.

## 7. The list row

One anatomy for `RadarEntry` and `PaperEntry`. Rows are separated by a 1 px `--rule`. No cards, no
backgrounds at rest.

```
640 px and up: grid 44px | minmax(0,1fr) | 88px, column gap 12, padding 20 0

 1 ◉   Speech decoding from intracortical arrays in a     [👍][👎]
       person with ALS                                         95
       Chen et al. · Nature · 18 Nov 2026 · Brain-computer interfaces
       new   intracortical

under 640 px: grid 28px | minmax(0,1fr), column gap 10, padding 18 0

 1     Speech decoding from intracortical
 ◉     arrays in a person with ALS
       Chen et al. · Nature · 18 Nov 2026 ·
       Brain-computer interfaces
       new   intracortical
       [ 👍 ][ 👎 ]                        95
```

- **Rank and dot.** Rank in mono 12, ink-faint, 5 px down so it sits on the title's first baseline.
  The rank sits in a fixed box `2ch` wide, right-aligned, tabular, so the dots of rows 1 to 20 form
  one straight vertical line (round 1 let a two-digit rank push its dot 6 px right).
  The dot is an 8 px circle in the cluster hue: beside the rank on wide (gap 10), under it on
  compact (gap 7). New: a 1.25 px `--spike` ring 2 px out from the dot. 👎: hollow, 1 px hue
  outline. The dot is always a plain circle, whatever the cell type.
- **Title.** Serif, `--ink`, no underline at rest. Hover or focus: 1 px underline in `--ink`,
  offset 4 px. `overflow-wrap: anywhere` on title and meta so a 220-character title wraps inside
  350 px (Review Focus 2). The title is never dimmed, not even for 👎.
- **Meta.** 6 px under the title. Authors · journal · date. The date is one `white-space: nowrap`
  run, so it never splits as "17 / Nov 2026". Every " · " belongs to the item before it, joined
  by a non-breaking space, so a line can end with a dot but never starts with one. Authors and
  journal still wrap freely. This lives in the shared row, for `RadarEntry` and `PaperEntry`. On the radar only, then
  ` · <topic name>` in the cluster hue at weight 500, `white-space: nowrap` so the name moves to the
  next line whole and never splits as "Brain-computer / interfaces". Public rows leave the topic out, because the
  whole page is one topic.
- **Reasons.** 6 px under the meta, 12 px gaps. If the paper is new, the first item is the word
  `new` in `--spike`, weight 500. It is real text, so the list says what the map says. Reasons are shown as stored, with one
  display-only repair: `1 weeks old`, `1 days old` and `1 months old` are shown in the singular.
  Do this in the row component. Do not touch `lib/ranking.ts`, the API or stored reasons. Do not
  drop or merge reasons: an interest term that happens to equal the field name is still the reason
  the paper ranked.
- **Aside, wide.** Radar: the two buttons on top, the score under them, right-aligned, 8 px apart.
  Public rows: the score only.
- **Actions, compact.** Radar: their own line, 10 px under the reasons, buttons on the left, score
  on the right. A long title can never push them off screen. Public rows have no buttons, so the
  score does not get a line to itself: it sits at the right end of the first reasons line
  (`margin-left: auto`, same baseline). Only a row with no reasons keeps a score line.
- **Rating buttons.** 36 × 32 px wide, 44 × 40 px compact, 6 px apart. 1 px `--control` border,
  4 px radius, transparent. The emoji is 15 px. This is the one control Kalp uses every day, so it
  has to look like a button at rest: border and glyph both reach 3:1 on `--paper`.
  - Not pressed, light: emoji `filter: grayscale(1) brightness(0.65)` at full opacity, which
    measures between 3.0 and 3.6:1 on paper. A grey emoji on paper is about 1.4:1 without the
    darkening, which is why round 1 looked disabled. Round 2 used 0.55 (4.3:1), and ten dark pairs
    down the right edge competed with the titles. An icon needs 3:1, not 4.5:1.
  - Not pressed, dark: emoji `filter: grayscale(1)` at 0.65 opacity, as in round 1. It must stay
    quieter than the title beside it.
  - Hover: border `--ink-faint`, background `--surface`, emoji in colour with no filter.
  - 👍 pressed: `--reinforce-wash` fill, `--reinforce` border, emoji in full colour.
  - 👎 pressed: `--surface-strong` fill, `--ink-muted` border, emoji in full colour.
  - Pending: `cursor: wait`, 0.6 opacity. "Not saved. Try again." in small ink-muted beside the
    buttons on compact and under them on wide.
  - `aria-pressed`, `aria-label` and `title` stay exactly as they are.
- **Row id.** `id="paper-<pmid>"` with `scroll-margin-top: 24px`.

Focus everywhere: `:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }`.

Links in prose keep an underline (1 px, `--ink-faint`, offset 4 px, `--ink` on hover).

## 8. Pages

All pages: one column, `max-w-2xl` (672 px) centred, side padding 32 px at 640 and up, 20 px below.
Top padding 48 px at 640 and up, 32 px below (down from 96 and 64, so a title is on screen sooner).
Sections are 56 px apart (44 px compact). A figure is `border-top: 1px --rule-strong`, the map, a
hairline, the caption (padding 6 0 8), a hairline.

**`/` (public)**

```
Sift                                   wordmark
──────────────────────────────────────  strong rule (the figure's top)
[ hero map: 6 clusters, labels ]        608×192 / 350×300
──────────────────────────────────────
6 fields · illustration, not live data  caption, mono 11

PubMed publishes about 280 papers …     lead, 32 px under the figure
It is not a search engine …             lead, ink-muted

Neuromodulation          ranked 13 d ago  h2 + small, strong rule
 1 ●  title …                       122   5 public rows
 …
The full neuromodulation feed

Topics                                   h2, strong rule
 ● Brain-computer interfaces             dot in that topic's hue, name serif 17
   Reading intention out of the brain …  meta
 …
footer
```

**`/t/<slug>` (public)**

```
Sift                                     small link
Neuromodulation                          h1
20 papers, ranked just now               meta
──────────────────────────────────────  strong rule (the figure's top)
[ topic map: top 8, rank 1 at the left ] 608×120 / 350×104
──────────────────────────────────────
top 8 of 20 papers  ○ 2 new in 48 h      caption, mono 11; the ○ part only when there are new ones
──────────────────────────────────────
 1 ●  title …                       122  rows
 …
The query                                small label, then mono 12 / 1.6, ink-muted
footer
```

The same frame at every width. The caption says "top 8 of 20 papers", or "all 5 papers" when the
page has eight or fewer.

**`/sign-in` (public, `ph-no-capture` stays)**

```
Sift
Sign in                                  h1
──────────────────────────────────────
The radar is a private feed for one …    lead, ink-muted

[   motif 220×112   ]                    motif and button share one block, 220 px wide, whose
[ Sign in with Google ]                  left edge is the column's left edge. The button fills
                                         the block (width 220, label centred), so its left edge
                                         lines up with the h1, the rule and the prose, and the
                                         hub still lands on its top centre, 0 px gap.
                                         Button: serif 17, 1 px --rule-strong border, padding
                                         8 16, hover background --surface
That sign-in did not complete. …         error, meta
footer
```

**`/me` and `/dev/radar` (private, `ph-no-capture` stays)**

```
Sift  My radar  Settings        Sign out  nav, small
My radar                                  h1
4 fields · ranked 3 hours ago · ranker p1 meta (the field names moved into the map)
──────────────────────────────────────
[ radar map ]                             608×232 / 350×184 (350×300 with 5–6 fields)
──────────────────────────────────────
10 papers  ○ 3 new in 48 h  ○ 1 marked useful   caption; the two ○ are 7 px rings in
──────────────────────────────────────          --spike and --reinforce
 1 ◉  title …                    [👍][👎]  10 rows
 …
👍 and 👎 teach the ranking …             footnote, small
footer
```

Caption counts drop out when zero ("10 papers" alone). No papers: the clusters keep their labels
and dormant-style cells, the caption reads "No papers today", and the existing empty-state
sentence follows. The 👍/👎 footnote is shown only when there is at least one row to rate. No followed topics: the dormant map, caption "No fields followed", then the
existing empty state.

**`/me/settings` and `/dev/settings` (private, `ph-no-capture` stays)**

```
Sift  My radar  Settings        Sign out
Settings                                  h1
reader@example.com                        meta
──────────────────────────────────────

Topics on your radar                      h2, strong rule
 ☑ Brain-computer interfaces              serif 17, row padding 14 0, hairlines,
 ☑ Neural engineering                     checkbox drawn by us (below)
 …
Saved.                                    small

Interests                                 h2, strong rule
Terms that lift a paper on your radar …   meta
 brain-computer interface  from Obsidian · +0.80    Delete
 …
footer
```

**The follow checkbox** is `appearance: none`, 16 × 16 px, 3 px radius, in both appearances.
Unchecked: 1 px `--control` border, transparent fill. Checked: `--ink` fill and border, with a
`--paper` tick (a `::before` with a `clip-path`, so it takes the tokens). Round 2 used the native
control with `accent-color`, and in dark mode the unchecked box was a solid white square, the
brightest thing on the page, which looked more "on" than the checked ones. The input stays a real
`<input type="checkbox">` with the same label, handler and focus ring.

No map here. **Interests get a restyle and nothing else**: the same rows, the same fields, the
same two actions. Nothing is added to that section (Kalp's instruction, repeated for round 2 and
again for round 3). Round 3 does not touch the Interests markup at all.

Under 640 px an interest row is two lines, so nothing wraps mid-phrase: the term on line one with
its action ("Delete" or "re-rate to change", `white-space: nowrap`) right-aligned on the same
line, then the provenance and weight ("from Obsidian · +0.80") on line two as one nowrap run. All
rows end up the same height. This is layout only. No dots, icons, counts or copy are added to
Interests or to the topic checkboxes.

**Footer (all pages).** Replace the zinc classes with tokens: `border-top: 1px --rule`, mono 11,
`--ink-faint`, same three items and wording. The rule is on the inner column (`max-w-2xl` less
the side padding), not on the full-width `<footer>`, so it ends where every other rule ends.

## 9. Don'ts

- Do not draw anything behind text. The map lives inside its figure box and nowhere else.
- Do not put rows in cards, tiles, panels or shadows. Rules only. The one filled background is the
  hover highlight.
- Do not make anything in a list larger, darker or heavier than a paper title. Do not dim, truncate
  or clamp a title.
- Do not animate anything that is not a spike, a burst, a pulse or a 150–400 ms state change. No
  drifting, breathing, twinkling, parallax, or looping CSS animation on resting cells.
- Do not exceed 3 dashes on screen, and do not fire a cell that is not new on `/me` or `/t/<slug>`.
  A firing cell there is a claim about data.
- Do not run a frame loop while the map rests, and do not run anything in a hidden tab or off
  screen.
- Do not use gradients, blur or glow filters, glass panels, drop shadows, or any purple-to-blue
  wash. The dark-mode halo is two flat discs. Colour appears only as small cells, thin strokes,
  labels and two button states.
- Do not use `--spike` or `--reinforce` for decoration. Vermilion means new. Gold means 👍.
- Do not let colour carry meaning alone. New has a ring and the word "new". 👍 has a ring, a thick
  fibre and `aria-pressed`. 👎 is hollow. Clusters have text labels.
- Do not draw straight edges, arrowheads, node-and-line graphs, a brain outline, or anything 3D.
  A long, nearly straight tract counts as a straight edge. Do not bring the commissures back.
- Do not let two cells' rings touch, or stand a soma on another cell's fibre.
- Do not render interests, ratings, follows or verdict state on `/`, `/t/<slug>` or `/sign-in`.
  The hero and topic maps read topic names, PMIDs and publication dates only.
- Do not add a web font, a CDN request, or an animation or graph library.
- Do not use `Math.random()` or the clock in anything that affects markup.
- Do not change `aria-pressed`, button labels, analytics events, open tracking or request bodies.
- Do not add fields, controls or copy to the Interests section.
- Do not hide state to make a cluster look fuller. A 👎 cell is drawn as a 👎 cell.
- Do not change `lib/ranking.ts`, the API, or stored reasons to fix a label. Repair display text in
  the row.
