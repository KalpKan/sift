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
  r: number;
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
};

const ROW_STEP = 142;

function specFor(variant: Variant, layout: LayoutName, clusterCount: number): Spec {
  if (variant === "radar") {
    if (layout === "wide") {
      return { W: 608, tail: 70, cols: 6, scale: 1, detail: 2, rMax: 56, top: 34, hubGap: 16, rowH: ROW_STEP, arc: 40, labelGap: 46, labelPx: 11, charW: 6.1 };
    }
    return clusterCount <= 4
      ? { W: 350, tail: 66, cols: 4, scale: 0.8, detail: 1, rMax: 31, top: 30, hubGap: 14, rowH: ROW_STEP, arc: 36, labelGap: 42, labelPx: 10, charW: 5.5 }
      : { W: 350, tail: 44, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 26, hubGap: 12, rowH: ROW_STEP, arc: 0, labelGap: 24, labelPx: 10, charW: 5.5 };
  }
  if (variant === "hero") {
    return layout === "wide"
      ? { W: 608, tail: 68, cols: 6, scale: 0.9, detail: 2, rMax: 40, top: 30, hubGap: 14, rowH: ROW_STEP, arc: 40, labelGap: 46, labelPx: 11, charW: 6.1 }
      : { W: 350, tail: 44, cols: 3, scale: 0.8, detail: 1, rMax: 34, top: 26, hubGap: 12, rowH: ROW_STEP, arc: 0, labelGap: 24, labelPx: 10, charW: 5.5 };
  }
  if (variant === "topic") {
    return layout === "wide"
      ? { W: 240, H: 168, tail: 0, cols: 1, scale: 0.86, detail: 2, rMax: 56, top: 30, hubGap: 14, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0 }
      : { W: 350, H: 140, tail: 0, cols: 1, scale: 0.8, detail: 1, rMax: 46, top: 26, hubGap: 12, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0 };
  }
  return { W: 200, H: 104, tail: 0, cols: 1, scale: 0.9, detail: 2, rMax: 28, top: 30, hubGap: 14, rowH: 0, arc: 0, labelGap: 0, labelPx: 0, charW: 0, hubAtBottom: true };
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
    const L = Math.min(5 * rs, maxUp);
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
      const L = Math.min(j(2.2, 3.0) * rs, a < 70 || a > 290 ? maxUp : 99);
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
    const t = add(x, y - rs * 1.2, lean, Math.min(3.4 * rs, maxUp), 1);
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
  if (kind === "bipolar") return { shape: "ellipse", rx: f(rs * 0.8), ry: f(rs * 1.2), strokeWidth: 0 };
  return { shape: "circle", rx: f(rs), ry: f(rs), strokeWidth: 0 };
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

function wrapLabel(label: string, maxChars: number): string[] {
  if (label.length <= maxChars) return [label];
  let cut = -1;
  for (let k = 0; k < label.length; k++) {
    const ch = label[k];
    if (ch === " " && k <= maxChars) cut = k;
    if (ch === "-" && k + 1 <= maxChars) cut = k + 1;
  }
  if (cut < 0) {
    // Nothing fits: break at the first space or hyphen, or keep a single long word whole.
    const sp = label.search(/[ -]/);
    cut = sp < 0 ? -1 : label[sp] === "-" ? sp + 1 : sp;
  }
  if (cut <= 0) return [label];
  return [label.slice(0, cut).trim(), label.slice(cut).trim()];
}

// ---------------------------------------------------------------------------
// buildNetwork
// ---------------------------------------------------------------------------

type Cluster = NetCluster & { cw: number; row: number; col: number };

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

  const cl: Cluster[] = clusters.map((c, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    let col = i % cols;
    if (row % 2 === 1) col = inRow - 1 - col; // the second row runs right to left
    const cw = width / inRow;
    const cx = f(cw * (col + 0.5));
    const cy = f(top + rMax + row * rowH + (n > 1 ? (i % 2 ? 5 : -5) : 0));
    const hue = ((c.index % 4) + 4) % 4;
    const hubY = spec.hubAtBottom ? spec.H! : top + 2 * rMax + hubGap + row * rowH;
    return {
      id: c.id,
      label: c.label,
      lines: [],
      x: cx,
      y: cy,
      r: f(Math.min(cw * 0.36, rMax)),
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

  // Labels: only where the variant draws them, never on a dormant map.
  if (labelGap > 0 && !dormant) {
    for (const c of cl) {
      const max = Math.floor((c.cw - 10) / charW);
      c.lines = c.label ? wrapLabel(c.label, max) : [];
    }
  }

  // Tracts (axon edges): consecutive hubs, closed into a ring from three clusters up.
  const edges: NetEdge[] = [];
  if (n > 1) {
    const pairs: [Cluster, Cluster][] = [];
    for (let i = 0; i < n - 1; i++) pairs.push([cl[i], cl[i + 1]]);
    if (n > 2) pairs.push([cl[n - 1], cl[0]]);
    for (const [a, b] of pairs) {
      const dx = b.hubX - a.hubX;
      const dy = b.hubY - a.hubY;
      let d: string;
      if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
        d = `C${f(a.hubX + dx * 0.3)},${f(a.hubY + 14)} ${f(b.hubX - dx * 0.3)},${f(b.hubY + 14)}`;
      } else if (a.row === b.row) {
        d = `C${f(a.hubX + dx * 0.12)},${f(a.hubY + arc)} ${f(b.hubX - dx * 0.12)},${f(b.hubY + arc)}`;
      } else {
        const ex = (a.hubX + b.hubX) / 2 > width / 2 ? width : 0;
        d = `C${ex},${f(a.hubY + dy * 0.25)} ${ex},${f(b.hubY - dy * 0.45)}`;
      }
      edges.push({ from: a.id, to: b.id, kind: "axon", d: `M${a.hubX},${a.hubY}${d} ${b.hubX},${b.hubY}` });
    }
  }

  // Neurons, placed cluster by cluster in rank order.
  const out: NetNeuron[] = [];
  for (const c of cl) {
    const mine = neurons.filter((x) => x.cluster === c.id).sort((a, b) => a.rank - b.rank);
    const placed: { x: number; y: number; rs: number }[] = [];
    for (const nu of mine) {
      const R = rng(nu.id);
      const rs = (7 - 0.4 * (nu.rank - 1)) * scale;
      let x = c.x;
      let y = c.y;
      let tries = 0;
      let sep = 2.8;
      let ok = false;
      do {
        const a = R() * Math.PI * 2;
        const d = Math.sqrt(R()) * Math.max(0, c.r - rs);
        x = c.x + Math.cos(a) * d;
        y = c.y + Math.sin(a) * d;
        ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) > sep * Math.max(p.rs, rs) + 4);
        if (++tries % 30 === 0) sep *= 0.85;
      } while (!ok && tries < 300);
      placed.push({ x, y, rs });

      const dn = dendrites(c.kind, x, y, rs, R, detail, y - rs - 6);
      const sy = y + rs * (c.kind === "bipolar" ? 1.2 : c.kind === "pyramidal" ? 0.8 : 1);
      const c1: [number, number] = [x + (R() - 0.5) * 10, sy + (c.hubY - sy) * 0.45];
      const c2: [number, number] = [c.hubX + (x - c.hubX) * 0.18, c.hubY - 22 * scale];
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
      });
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
      r: c.r,
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
