/**
 * The network model: pure and deterministic. It turns clusters (fields) and
 * neurons (papers) into positions, cell glyphs and wiring for the brain map
 * (docs/design/brain.md sections 4 and 5).
 *
 * No `Math.random`, no clock. Every random choice comes from a PRNG seeded by
 * the neuron's id (a PMID), so the server render and the client agree and a
 * paper keeps its shape between visits.
 *
 * The plan's `dendrite` edges are the fibres: one per neuron, from the neuron
 * to its cluster's hub. `axon` edges are the tracts between clusters. The
 * dendrites drawn on a cell are part of the glyph, not edges.
 */

export const HOUR_MS = 3600_000;

/** True iff the paper was published 0 to 48 hours before `now` (inclusive). */
export function isNew(publishedIso: string, now: Date): boolean {
  const t = Date.parse(publishedIso);
  if (Number.isNaN(t)) return false;
  const age = now.getTime() - t;
  return age >= 0 && age <= 48 * HOUR_MS;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (xmur3 seed, mulberry32 stream)
// ---------------------------------------------------------------------------

function xmur3(s: string): () => number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** A float stream in [0, 1) that depends only on `seed`. */
export function rng(seed: string): () => number {
  let a = xmur3(seed)();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Variant = "radar" | "hero" | "topic" | "motif";
export type LayoutName = "wide" | "compact";
export const KINDS = ["pyramidal", "stellate", "purkinje", "bipolar"] as const;
export type CellKind = (typeof KINDS)[number];
export type Verdict = 1 | -1 | null;

export type NetworkInput = {
  variant: Variant;
  layout: LayoutName;
  /** `index` picks hue and cell type (index mod 4); it defaults to the position in this list. */
  clusters: { id: string; label: string; index?: number }[];
  neurons: {
    id: string;
    cluster: string;
    rank: number;
    isNew: boolean;
    verdict: Verdict;
    /** A decorative cell (hero, motif): drawn in full colour, but it is not a paper. */
    decorative?: boolean;
  }[];
  /** Overrides, used only by tests and one-off figures. The variant table decides otherwise. */
  width?: number;
  height?: number;
};

export type NetCluster = {
  id: string;
  label: string;
  /** The label broken to fit the column, empty when the variant draws no label or the map is dormant. */
  lines: string[];
  x: number;
  y: number;
  /** The cluster is an ellipse: soma centres are placed inside it. */
  rx: number;
  ry: number;
  hue: number;
  kind: CellKind;
  hubX: number;
  hubY: number;
  labelY: number;
};

export type NetNeuron = {
  id: string;
  cluster: string;
  x: number;
  y: number;
  /** Soma radius. */
  size: number;
  rank: number;
  isNew: boolean;
  verdict: Verdict;
  kind: CellKind;
  hue: number;
  /** Dormant-style cell: drawn in `--wire`, carries no paper. */
  ghost: boolean;
  decorative: boolean;
  /** Whole-cell opacity at rest. */
  opacity: number;
  soma: { shape: "triangle" | "ellipse" | "circle"; d?: string; rx: number; ry: number; strokeWidth: number };
  /** The 1 px and 0.75 px dendrite strokes, one path string each. */
  dendrites: { thick: string; thin: string };
  fibre: string;
  fibreLen: number;
  /** Radius of the invisible tap target (radar only, real cells only); 0 for every other cell. */
  hit: number;
};

export type NetEdge = { from: string; to: string; kind: "dendrite" | "axon"; d: string };

export type Network = {
  variant: Variant;
  layout: LayoutName;
  width: number;
  height: number;
  clusters: NetCluster[];
  neurons: NetNeuron[];
  edges: NetEdge[];
  dormant: boolean;
  /** Map scale: also sizes the spike dash. */
  scale: number;
  /** Cluster label font size in px, 0 when the variant draws no labels. */
  labelPx: number;
};

// ---------------------------------------------------------------------------
// The variant table (docs/design/brain.md, "Layout numbers")
// ---------------------------------------------------------------------------

type Spec = {
  W: number;
  /** Fixed height, or undefined to derive it from the lowest hub plus `tail`. */
  H?: number;
  tail: number;
  cols: number;
  scale: number;
  detail: 1 | 2;
  rMax: number;
  top: number;
  hubGap: number;
  rowH: number;
  arc: number;
  labelGap: number;
  labelPx: number;
  charW: number;
  hubAtBottom?: boolean;
  /** Fixed horizontal radius of the cluster ellipse (the topic fan, the motif); otherwise see `clusterRx`. */
  rxFixed?: number;
  /** The topic fan: cell k of 8 stands at the k-th eighth of the ellipse, left to right. */
  fan?: boolean;
};

const ROW_STEP = 142;

/**
 * Horizontal radius of a cluster ellipse (docs/design/brain.md section 5). A single followed field on the
 * radar spreads over the figure's width; the compact radar with two to four fields uses 0.42 of its column,
 * so a busy column has room to keep its rings apart. Everything else is min(0.36 * column, 2.2 * rMax).
 */
function clusterRx(variant: Variant, layout: LayoutName, n: number, cw: number, rMax: number): number {
  if (variant === "radar" && n === 1) return Math.min(0.42 * cw, 3.4 * rMax);
  if (variant === "radar" && layout === "compact" && n >= 2 && n <= 4) return 0.42 * cw;
  return Math.min(0.36 * cw, 2.2 * rMax);
}

function specFor(variant: Variant, layout: LayoutName, clusterCount: number): Spec {
  const n = clusterCount;
  if (variant === "radar") {
    if (layout === "wide") {
      return { W: 608, tail: 70, cols: 6, scale: n >= 5 ? 1.1 : 1.25, detail: 2, rMax: 56, top: 34, hubGap: 16, rowH: ROW_STEP, arc: 34, labelGap: 46, labelPx: 11, charW: 6.1 };
    }
    return n <= 4
      ? { W: 350, H: 184, tail: 0, cols: 4, scale: 0.9, detail: 1, rMax: 34, top: 30, hubGap: 14, rowH: ROW_STEP, arc: 30, labelGap: 44, labelPx: 10, charW: 5.7 }
      : { W: 350, tail: 52, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 26, hubGap: 12, rowH: ROW_STEP, arc: 0, labelGap: 27, labelPx: 10, charW: 5.7 };
  }
  if (variant === "hero") {
    if (layout === "wide") {
      return { W: 608, tail: 68, cols: 6, scale: 1.0, detail: 2, rMax: 40, top: 30, hubGap: 14, rowH: ROW_STEP, arc: 34, labelGap: 46, labelPx: 11, charW: 6.1 };
    }
    // One cluster has no tract, so it keeps the short box. Two or three stand in one row and need the
    // room under the hubs for the closing arc; four or more run in two rows of three.
    if (n === 1) return { W: 350, tail: 44, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 26, hubGap: 12, rowH: ROW_STEP, arc: 0, labelGap: 27, labelPx: 10, charW: 5.7 };
    if (n <= 3) return { W: 350, tail: 66, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 30, hubGap: 14, rowH: ROW_STEP, arc: 30, labelGap: 44, labelPx: 10, charW: 5.7 };
    return { W: 350, tail: 52, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 26, hubGap: 12, rowH: ROW_STEP, arc: 0, labelGap: 27, labelPx: 10, charW: 5.7 };
  }
  if (variant === "topic") {
    return layout === "wide"
      ? { W: 608, H: 120, tail: 0, cols: 1, scale: 1.1, detail: 2, rMax: 28, top: 34, hubGap: 16, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0, hubAtBottom: true, rxFixed: 200, fan: true }
      : { W: 350, H: 104, tail: 0, cols: 1, scale: 0.9, detail: 1, rMax: 24, top: 30, hubGap: 14, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0, hubAtBottom: true, rxFixed: 140, fan: true };
  }
  return { W: 220, H: 112, tail: 0, cols: 1, scale: 1.3, detail: 2, rMax: 32, top: 30, hubGap: 14, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0, hubAtBottom: true, rxFixed: 70 };
}

// ---------------------------------------------------------------------------
// Cell glyphs
// ---------------------------------------------------------------------------

type Stroke = { d: string; w: number };

function pol(x: number, y: number, ang: number, len: number): [number, number] {
  const a = ((ang - 90) * Math.PI) / 180;
  return [x + Math.cos(a) * len, y + Math.sin(a) * len];
}

/** A curved segment from (x, y) heading `ang` degrees clockwise from up, bent sideways by `bend` of its length. */
function seg(x: number, y: number, ang: number, len: number, bend: number) {
  const [ex, ey] = pol(x, y, ang, len);
  const [mx, my] = pol(x, y, ang, len * 0.5);
  const [cx, cy] = pol(mx, my, ang + 90, len * bend);
  return { d: `M${f(x)},${f(y)}Q${f(cx)},${f(cy)} ${f(ex)},${f(ey)}`, ex, ey };
}

function dendrites(kind: CellKind, x: number, y: number, rs: number, R: () => number, detail: 1 | 2, maxUp: number): Stroke[] {
  const out: Stroke[] = [];
  const j = (a: number, b: number) => a + (b - a) * R();
  const sgn = () => (R() < 0.5 ? -1 : 1);
  const add = (x0: number, y0: number, ang: number, len: number, w: number) => {
    const s = seg(x0, y0, ang, len, j(-0.14, 0.14));
    out.push({ d: s.d, w });
    return s;
  };

  if (kind === "pyramidal") {
    // The tuft continues 1.6 rs past the trunk's tip, so the trunk leaves that much room above it.
    const L = Math.max(rs, Math.min(5 * rs, maxUp - 1.7 * rs));
    const lean = j(-7, 7);
    const t = add(x, y - rs, lean, L, 1);
    add(t.ex, t.ey, lean - j(24, 40), 1.6 * rs, 0.75);
    add(t.ex, t.ey, lean + j(24, 40), 1.6 * rs, 0.75);
    if (detail > 1) {
      const [ox, oy] = pol(x, y - rs, lean, L * 0.55);
      add(ox, oy, lean + sgn() * j(48, 62), 1.5 * rs, 0.75);
    }
    for (const s of [-1, 1]) {
      const a = s * j(113, 137);
      const [bx, by] = pol(x, y, a, rs * 0.9);
      const b = add(bx, by, a, 2.2 * rs, 1);
      if (detail > 1) add(b.ex, b.ey, a - s * j(20, 35), 1.0 * rs, 0.75);
    }
  } else if (kind === "stellate") {
    const n = 5;
    const off = j(0, 360);
    for (let i = 0; i < n; i++) {
      let a = (off + i * (360 / n) + j(-14, 14)) % 360;
      if (a > 155 && a < 205) a = a < 180 ? 150 : 210;
      const [bx, by] = pol(x, y, a, rs);
      const L = Math.min(j(2.2, 3.0) * rs, a < 70 || a > 290 ? Math.max(rs, maxUp - 0.6 * rs) : 99);
      add(bx, by, a, L, 1);
      if (detail > 1 || i % 2 === 0) {
        const [fx, fy] = pol(bx, by, a, L * 0.6);
        add(fx, fy, a + sgn() * j(28, 42), 1.1 * rs, 0.75);
      }
    }
  } else if (kind === "purkinje") {
    for (const s of [-1, 1]) {
      const a = s * j(16, 28);
      const [bx, by] = pol(x, y, a, rs);
      const L1 = Math.min(2.2 * rs, maxUp * 0.45);
      const t = add(bx, by, a, L1, 1);
      for (const s2 of [-1, 1]) {
        const a2 = a + s2 * j(22, 34);
        const u = add(t.ex, t.ey, a2, Math.min(1.7 * rs, maxUp * 0.33), 0.75);
        if (detail > 1) for (const s3 of [-1, 1]) add(u.ex, u.ey, a2 + s3 * j(18, 30), Math.min(1.2 * rs, maxUp * 0.22), 0.75);
      }
    }
  } else {
    const lean = j(-6, 6);
    const t = add(x, y - rs * 1.2, lean, Math.max(rs, Math.min(3.4 * rs, maxUp - 1.3 * rs)), 1);
    add(t.ex, t.ey, lean - j(24, 36), 1.2 * rs, 0.75);
    add(t.ex, t.ey, lean + j(24, 36), 1.2 * rs, 0.75);
  }
  return out;
}

function somaShape(kind: CellKind, x: number, y: number, rs: number): NetNeuron["soma"] {
  if (kind === "pyramidal") {
    const d = `M${f(x)},${f(y - rs * 0.95)}L${f(x + rs * 0.8)},${f(y + rs * 0.55)}L${f(x - rs * 0.8)},${f(y + rs * 0.55)}Z`;
    return { shape: "triangle", d, rx: rs, ry: rs, strokeWidth: f(rs * 0.55) };
  }
  if (kind === "bipolar") return { shape: "ellipse", rx: Math.round(rs * 80) / 100, ry: Math.round(rs * 120) / 100, strokeWidth: 0 };
  return { shape: "circle", rx: Math.round(rs * 100) / 100, ry: Math.round(rs * 100) / 100, strokeWidth: 0 };
}

/** Arc length of a cubic Bezier, by 24 straight pieces. */
function cubicLength(p: [number, number][]): number {
  let len = 0;
  let prev = p[0];
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
    const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
    len += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
  }
  return len;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * Break a label that is too long for its column into two lines, at a space or
 * after a hyphen. Of the places it can break, take the one that leaves the
 * shorter longest line, so "Brain-computer interfaces" splits after
 * "Brain-computer" rather than after "Brain-" (which would leave a line wider
 * than the column). A single long word stays on one line.
 */
function wrapLabel(label: string, maxChars: number): string[] {
  if (label.length <= maxChars) return [label];
  let best = -1;
  let bestLen = Infinity;
  for (let k = 0; k < label.length; k++) {
    const ch = label[k];
    const cut = ch === " " ? k : ch === "-" && k + 1 < label.length ? k + 1 : -1;
    if (cut <= 0) continue;
    const longest = Math.max(label.slice(0, cut).trim().length, label.slice(cut).trim().length);
    if (longest <= bestLen) {
      best = cut;
      bestLen = longest;
    }
  }
  if (best < 0) return [label];
  return [label.slice(0, best).trim(), label.slice(best).trim()];
}

// ---------------------------------------------------------------------------
// Placement clearances (docs/design/brain.md section 5)
// ---------------------------------------------------------------------------

/** A cell's extent is its soma plus this (room for the 👍 ring when it is not new). */
const EXT_REST = 4.5;
/** ...plus this when the cell is new, so the gold ring at rs + 6.5 clears the vermilion one. */
const EXT_NEW = 7.5;
const FIBRE_POINTS = 24;

type Placed = { x: number; y: number; rs: number; ext: number; real: boolean; fp: [number, number][] };

/** The cubic a cell's fibre follows, from its soma's bottom to the hub; `j` in [0, 1) is the seeded sideways jitter. */
function fibreGeometry(c: { kind: CellKind; hubX: number; hubY: number }, x: number, y: number, rs: number, scale: number, j: number) {
  const sy = y + rs * (c.kind === "bipolar" ? 1.2 : c.kind === "pyramidal" ? 0.8 : 1);
  const c1: [number, number] = [x + (j - 0.5) * 10, sy + (c.hubY - sy) * 0.45];
  const c2: [number, number] = [c.hubX + (x - c.hubX) * 0.18, c.hubY - 22 * scale];
  return { sy, c1, c2, x, hubX: c.hubX, hubY: c.hubY };
}

function sampleFibre(g: ReturnType<typeof fibreGeometry>): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= FIBRE_POINTS; i++) {
    const t = i / FIBRE_POINTS;
    const u = 1 - t;
    out.push([
      u * u * u * g.x + 3 * u * u * t * g.c1[0] + 3 * u * t * t * g.c2[0] + t * t * t * g.hubX,
      u * u * u * g.sy + 3 * u * u * t * g.c1[1] + 3 * u * t * t * g.c2[1] + t * t * t * g.hubY,
    ]);
  }
  return out;
}

const nearest = (px: number, py: number, pts: [number, number][]) => {
  let d = Infinity;
  for (const [x, y] of pts) d = Math.min(d, Math.hypot(x - px, y - py));
  return d;
};

/**
 * How well a candidate soma at (x, y) keeps clear of the cells already placed, as the smallest
 * ratio of actual to required distance over three rules: extents stay apart (centres at least
 * ext_a + ext_b + 2), the new soma is at least rs + 4 from every placed fibre, and its own fibre is
 * at least rs_other + 4 from every placed soma. A ratio of 1 or more means every rule holds; the
 * caller relaxes the bar by 15% every 30 failures. `hitOk` is the phone rule: real somas 28 px apart.
 */
function worstClearance(placed: Placed[], x: number, y: number, rs: number, ext: number, fp: [number, number][], hitRule: boolean) {
  let ratio = Infinity;
  let hitOk = true;
  for (const p of placed) {
    const d = Math.hypot(p.x - x, p.y - y);
    ratio = Math.min(ratio, d / (ext + p.ext + 2));
    ratio = Math.min(ratio, nearest(x, y, p.fp) / (rs + 4));
    ratio = Math.min(ratio, nearest(p.x, p.y, fp) / (p.rs + 4));
    if (hitRule && p.real && d < HIT_APART) hitOk = false;
  }
  return { ratio, hitOk };
}

// ---------------------------------------------------------------------------
// buildNetwork
// ---------------------------------------------------------------------------

type Cluster = NetCluster & { cw: number; row: number; col: number };

/** Every U tract dips this far below its hubs at its control points. */
const U_DIP = 14;
const HIT_MIN = 14;
const HIT_MAX = 22;
/** Compact radar: real somas are kept at least this far apart so every tap target can be 14 px without overlap. */
const HIT_APART = 2 * HIT_MIN;

export function buildNetwork(input: NetworkInput): Network {
  const { variant, layout } = input;
  const dormant = input.clusters.length === 0;

  const clusters = dormant
    ? [0, 1, 2].map((i) => ({ id: `dormant-${i}`, label: "", index: i }))
    : input.clusters.map((c, i) => ({ ...c, index: c.index ?? i }));

  type N = NetworkInput["neurons"][number] & { ghost: boolean };
  let neurons: N[];
  if (dormant) {
    neurons = clusters.flatMap((c) =>
      [3, 7].map((rank) => ({ id: `ghost-${c.id}-${rank}`, cluster: c.id, rank, isNew: false, verdict: null, ghost: true })),
    );
  } else {
    const known = new Set(clusters.map((c) => c.id));
    neurons = input.neurons.filter((n) => known.has(n.cluster)).map((n) => ({ ...n, ghost: false }));
    if (variant === "radar") {
      // A followed field with no paper today still gets two dormant-style cells.
      for (const c of clusters) {
        if (!neurons.some((n) => n.cluster === c.id)) {
          for (const rank of [3, 7]) neurons.push({ id: `ghost-${c.id}-${rank}`, cluster: c.id, rank, isNew: false, verdict: null, ghost: true });
        }
      }
    }
  }

  const n = clusters.length;
  const spec = specFor(variant, layout, n);
  const { W, cols, scale, detail, rMax, top, hubGap, rowH, arc, labelGap, labelPx, charW } = spec;
  const width = input.width ?? W;
  const rowCount = Math.ceil(n / cols);
  const twoRow = rowCount > 1;

  const cl: Cluster[] = clusters.map((c, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    // Both rows of a two-row layout run left to right on the same column grid.
    const col = i % cols;
    const cw = width / (twoRow ? cols : inRow);
    const cx = f(cw * (col + 0.5));
    const cy = f(top + rMax + row * rowH + (n > 1 ? (i % 2 ? 5 : -5) : 0));
    const hue = ((c.index % 4) + 4) % 4;
    const hubY = spec.hubAtBottom ? spec.H! : top + 2 * rMax + hubGap + row * rowH;
    const rx = spec.rxFixed ?? clusterRx(variant, layout, n, cw, rMax);
    return {
      id: c.id,
      label: c.label,
      lines: [],
      x: cx,
      y: cy,
      rx: f(rx),
      ry: f(Math.min(rx, rMax)),
      hue,
      kind: KINDS[hue],
      hubX: cx,
      hubY: f(hubY),
      labelY: f(hubY + labelGap),
      cw,
      row,
      col,
    };
  });

  const lowestHub = n ? Math.max(...cl.map((c) => c.hubY)) : 0;
  const height = input.height ?? spec.H ?? f(lowestHub + spec.tail);

  // Labels: only where the variant draws them, never on a dormant map. A two-row layout keeps
  // neighbouring labels well apart.
  if (labelGap > 0 && !dormant) {
    for (const c of cl) {
      const max = Math.floor((c.cw - (twoRow ? 28 : 10)) / charW);
      c.lines = c.label ? wrapLabel(c.label, max) : [];
    }
  }

  // Tracts (axon edges). A single row: a shallow U between neighbours, closed into a ring from
  // three clusters up by one long arc under the U's. Two rows: each row keeps its own U's and
  // nothing joins the rows (no closing arc, no commissures).
  const edges: NetEdge[] = [];
  const hub = (c: Cluster) => `${c.hubX},${c.hubY}`;
  const uTract = (a: Cluster, b: Cluster) => {
    const dx = b.hubX - a.hubX;
    return `M${hub(a)}C${f(a.hubX + dx * 0.3)},${f(a.hubY + U_DIP)} ${f(b.hubX - dx * 0.3)},${f(b.hubY + U_DIP)} ${hub(b)}`;
  };
  if (n > 1) {
    for (let i = 0; i < n - 1; i++) {
      if (cl[i].row !== cl[i + 1].row) continue;
      edges.push({ from: cl[i].id, to: cl[i + 1].id, kind: "axon", d: uTract(cl[i], cl[i + 1]) });
    }
    if (!twoRow && n > 2) {
      const a = cl[n - 1];
      const b = cl[0];
      const dx = b.hubX - a.hubX;
      edges.push({
        from: a.id,
        to: b.id,
        kind: "axon",
        d: `M${hub(a)}C${f(a.hubX + dx * 0.12)},${f(a.hubY + arc)} ${f(b.hubX - dx * 0.12)},${f(b.hubY + arc)} ${hub(b)}`,
      });
    }
  }

  // Neurons, placed cluster by cluster in rank order.
  const compactRadar = variant === "radar" && layout === "compact";
  const out: NetNeuron[] = [];
  for (const c of cl) {
    const mine = neurons.filter((x) => x.cluster === c.id).sort((a, b) => a.rank - b.rank);
    const placed: Placed[] = [];
    // Dendrites of a second row stop below the first row's labels.
    const ceil = c.row === 0 || labelGap === 0 ? 6 : cl.find((q) => q.row === c.row - 1)!.hubY + labelGap + labelPx + 2 + 6;
    for (const nu of mine) {
      const R = rng(nu.id);
      const rs = (7 - 0.4 * (nu.rank - 1)) * scale;
      const real = !nu.ghost && !nu.decorative;
      const ext = rs + (nu.isNew ? EXT_NEW : EXT_REST);
      const geo = (x: number, y: number, j: number) => fibreGeometry(c, x, y, rs, scale, j);
      // A candidate spot with the fibre it would carry, and its worst clearance (see `worstClearance`).
      const candidate = (x: number, y: number, j: number, tries: number) => {
        const g = geo(x, y, j);
        const fp = sampleFibre(g);
        const hitRule = compactRadar && real && tries < 200;
        return { x, y, j, fp, ...worstClearance(placed, x, y, rs, ext, fp, hitRule) };
      };
      let best: ReturnType<typeof candidate>;
      if (spec.fan) {
        // The topic fan: cell k (rank 1 to 8, left to right) stands at the k-th eighth of the ellipse.
        // Its x is fixed, so only the seeded y is redrawn, up to 20 times.
        const k = Math.min(8, Math.max(1, nu.rank));
        const ratio = (2 * k - 1) / 8 - 1;
        const x = c.x + c.rx * ratio + (R() * 2 - 1) * 6;
        const across = Math.min(0.97, Math.abs(x - c.x) / c.rx);
        const half = c.ry * Math.sqrt(1 - across * across);
        best = candidate(x, c.y + (R() * 2 - 1) * Math.max(0, half - rs), R(), 0);
        for (let t = 1; t < 20 && best.ratio < 1; t++) {
          const cand = candidate(x, c.y + (R() * 2 - 1) * Math.max(0, half - rs), R(), 0);
          if (cand.ratio > best.ratio) best = cand;
        }
      } else {
        // Uniform in the ellipse (shrunk by the soma radius), in rank order. A spot is kept if every
        // clearance holds; every 30 failures all clearances relax by 15%. After 300 tries the best
        // candidate seen wins, not the last one drawn. On a phone, real cells also keep 28 px apart
        // where there is room (the first 200 tries), so each can have a 14 px tap target.
        let tries = 0;
        let relax = 1;
        best = undefined as unknown as ReturnType<typeof candidate>;
        for (;;) {
          const a = R() * Math.PI * 2;
          const d = Math.sqrt(R());
          const cand = candidate(
            c.x + Math.cos(a) * d * Math.max(0, c.rx - rs),
            c.y + Math.sin(a) * d * Math.max(0, c.ry - rs),
            R(),
            tries,
          );
          if (!best || cand.ratio > best.ratio) best = cand;
          if (cand.ratio >= relax && cand.hitOk) {
            best = cand;
            break;
          }
          if (++tries >= 300) break;
          if (tries % 30 === 0) relax *= 0.85;
        }
      }
      const { x, y } = best;
      placed.push({ x, y, rs, ext, real, fp: best.fp });

      const dn = dendrites(c.kind, x, y, rs, R, detail, y - rs - ceil);
      const g = geo(x, y, best.j);
      const { sy, c1, c2 } = g;
      const fibre = `M${f(x)},${f(sy)}C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${c.hubX},${c.hubY}`;
      const fibreLen = f(cubicLength([[x, sy], c1, c2, [c.hubX, c.hubY]]));
      edges.push({ from: nu.id, to: c.id, kind: "dendrite", d: fibre });

      out.push({
        id: nu.id,
        cluster: c.id,
        x: f(x),
        y: f(y),
        size: Math.round(rs * 1000) / 1000,
        rank: nu.rank,
        isNew: nu.isNew,
        verdict: nu.verdict,
        kind: c.kind,
        hue: c.hue,
        ghost: nu.ghost,
        decorative: !!nu.decorative,
        opacity: Math.round((1 - 0.035 * (nu.rank - 1)) * 1000) / 1000,
        soma: somaShape(c.kind, x, y, rs),
        dendrites: {
          thick: dn.filter((q) => q.w === 1).map((q) => q.d).join(""),
          thin: dn.filter((q) => q.w !== 1).map((q) => q.d).join(""),
        },
        fibre,
        fibreLen,
        hit: 0,
      });
    }
  }

  // Tap targets (radar only). Wide: just past the soma. Compact: up to a thumb where there is
  // room (half the distance to the nearest other real soma, 14 to 22 px) and never overlapping.
  if (variant === "radar") {
    const real = out.filter((q) => !q.ghost && !q.decorative);
    for (const q of real) {
      if (layout === "wide") {
        q.hit = Math.max(q.size + 6, HIT_MIN);
        continue;
      }
      const others = real.filter((o) => o !== q);
      const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - q.x, o.y - q.y))) : 2 * HIT_MAX;
      // Rounded down, so two neighbours' targets can touch but never overlap.
      q.hit = Math.floor(Math.min(HIT_MAX, Math.max(HIT_MIN, d / 2)) * 10) / 10;
    }
  }

  return {
    variant,
    layout,
    width,
    height,
    scale,
    labelPx: dormant ? 0 : labelPx,
    dormant,
    clusters: cl.map((c) => ({
      id: c.id,
      label: c.label,
      lines: c.lines,
      x: c.x,
      y: c.y,
      rx: c.rx,
      ry: c.ry,
      hue: c.hue,
      kind: c.kind,
      hubX: c.hubX,
      hubY: c.hubY,
      labelY: c.labelY,
    })),
    neurons: out,
    edges,
  };
}

// ---------------------------------------------------------------------------
// Neuron sets for the figures that are not data
// ---------------------------------------------------------------------------

/** Hero: three decorative cells per public field, sized as ranks 2, 5 and 8, seeded from the slug. */
export function heroNeurons(clusters: { id: string }[]): NetworkInput["neurons"] {
  return clusters.flatMap((c) =>
    [2, 5, 8].map((rank, k) => ({ id: `${c.id}-${k}`, cluster: c.id, rank, isNew: false, verdict: null, decorative: true })),
  );
}

/** Sign-in motif: three decorative cells (ranks 2, 5, 7) in slot 1. */
export function motifNeurons(clusterId = "motif"): NetworkInput["neurons"] {
  return [2, 5, 7].map((rank, k) => ({ id: `motif-${k}`, cluster: clusterId, rank, isNew: false, verdict: null, decorative: true }));
}
