import { describe, expect, it } from "vitest";
import { buildNetwork, heroNeurons, isNew, type NetworkInput } from "./network";

const clusters = [
  { id: "bci", label: "Brain-computer interfaces" },
  { id: "ne", label: "Neural engineering" },
  { id: "dbs", label: "Deep brain stimulation" },
  { id: "sc", label: "Stem cells" },
];
const topics = ["bci", "bci", "ne", "dbs", "dbs", "sc", "ne", "bci", "sc", "dbs"];
const neurons = topics.map((cluster, i) => ({
  id: String(40000001 + i),
  cluster,
  rank: i + 1,
  isNew: i < 3,
  verdict: (i === 1 ? 1 : i === 5 ? -1 : null) as 1 | -1 | null,
}));
const radar = (over: Partial<NetworkInput> = {}): NetworkInput => ({
  variant: "radar",
  layout: "wide",
  clusters,
  neurons,
  ...over,
});

describe("isNew", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  it("is true inside 0..48 h and false outside", () => {
    expect(isNew("2026-11-03T12:00:00Z", now)).toBe(true);
    expect(isNew(new Date(now.getTime() - 47 * 3600_000).toISOString(), now)).toBe(true);
    expect(isNew(new Date(now.getTime() - 48 * 3600_000).toISOString(), now)).toBe(true);
    expect(isNew(new Date(now.getTime() - 48 * 3600_000 - 1).toISOString(), now)).toBe(false);
  });
  it("is false for a future date and for garbage", () => {
    expect(isNew("2026-11-03T12:00:01Z", now)).toBe(false);
    expect(isNew("not a date", now)).toBe(false);
  });
  it("does not fire for a month-precision date checked on the 3rd (Review Focus 1)", () => {
    expect(isNew("2026-11-01T00:00:00Z", now)).toBe(false);
  });
});

describe("buildNetwork", () => {
  it("is deterministic: the same input gives deep-equal output", () => {
    expect(buildNetwork(radar())).toEqual(buildNetwork(radar()));
  });

  it("keeps every soma inside its cluster's ellipse, shrunk by the soma radius", () => {
    for (const layout of ["wide", "compact"] as const) {
      const net = buildNetwork(radar({ layout }));
      const byId = new Map(net.clusters.map((c) => [c.id, c]));
      for (const n of net.neurons) {
        const c = byId.get(n.cluster)!;
        const u = (n.x - c.x) / Math.max(0.001, c.rx - n.size);
        const v = (n.y - c.y) / Math.max(0.001, c.ry - n.size);
        expect(u * u + v * v).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it("makes a cluster an ellipse: rx = min(0.36 * column, 2.2 * rMax), ry = min(rx, rMax)", () => {
    const one = buildNetwork(radar({ clusters: clusters.slice(0, 1), neurons: [] }));
    expect(one.clusters[0].rx).toBeCloseTo(123.2, 1); // 2.2 * 56, the column is 608 wide
    expect(one.clusters[0].ry).toBe(56);
    const four = buildNetwork(radar());
    expect(four.clusters[0].rx).toBeCloseTo(54.7, 1); // 0.36 * 152
    expect(four.clusters[0].ry).toBeCloseTo(54.7, 1);
  });

  it("has one neuron per input neuron", () => {
    expect(buildNetwork(radar()).neurons).toHaveLength(neurons.length);
  });

  it("draws one fibre (dendrite edge) per neuron, to its cluster hub", () => {
    const net = buildNetwork(radar());
    const fibres = net.edges.filter((e) => e.kind === "dendrite");
    expect(fibres).toHaveLength(neurons.length);
    for (const e of fibres) {
      const n = net.neurons.find((x) => x.id === e.from)!;
      expect(e.to).toBe(n.cluster);
    }
  });

  it.each([
    [1, 0],
    [2, 1],
    [3, 3],
    [4, 4],
  ])("with %i clusters has %i inter-cluster axon edges", (n, edges) => {
    const cs = clusters.slice(0, n);
    const ns = neurons.filter((x) => cs.some((c) => c.id === x.cluster));
    const net = buildNetwork(radar({ clusters: cs, neurons: ns }));
    expect(net.edges.filter((e) => e.kind === "axon")).toHaveLength(edges);
  });

  it("gives a lower rank a larger size: 8.75 px at rank 1 to 4.25 px at rank 10 on the wide radar (scale 1.25)", () => {
    const net = buildNetwork(radar());
    const size = (id: string) => net.neurons.find((n) => n.id === id)!.size;
    expect(net.scale).toBe(1.25);
    expect(size("40000001")).toBeCloseTo(8.75, 5);
    expect(size("40000010")).toBeCloseTo(4.25, 5);
    expect(size("40000001")).toBeGreaterThan(size("40000002"));
  });

  it("drops the wide radar to scale 1.1 with five or six fields, and the compact one is 0.9 for up to four", () => {
    const names = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, label: id }));
    expect(buildNetwork(radar({ clusters: names.slice(0, 4), neurons: [] })).scale).toBe(1.25);
    expect(buildNetwork(radar({ clusters: names.slice(0, 5), neurons: [] })).scale).toBe(1.1);
    expect(buildNetwork(radar({ clusters: names, neurons: [] })).scale).toBe(1.1);
    expect(buildNetwork(radar({ layout: "compact" })).scale).toBe(0.9);
    expect(buildNetwork({ variant: "hero", layout: "wide", clusters: names, neurons: [] }).scale).toBe(1);
  });

  it("is dormant with no clusters: decorative cells, no labels, same height", () => {
    const live = buildNetwork(radar());
    for (const layout of ["wide", "compact"] as const) {
      const net = buildNetwork(radar({ layout, clusters: [], neurons: [] }));
      const ref = buildNetwork(radar({ layout }));
      expect(net.dormant).toBe(true);
      expect(net.neurons.length).toBeGreaterThan(0);
      expect(net.neurons.every((n) => n.ghost)).toBe(true);
      expect(net.clusters.every((c) => c.lines.length === 0)).toBe(true);
      expect(net.height).toBe(layout === "wide" ? 232 : 184);
      expect(net.height).toBe(ref.height);
    }
    expect(live.dormant).toBe(false);
  });

  it("gives a followed field with no papers a label and two ghost cells at ranks 3 and 7", () => {
    const net = buildNetwork(radar({ neurons: neurons.filter((n) => n.cluster !== "sc") }));
    const sc = net.neurons.filter((n) => n.cluster === "sc");
    expect(sc.map((n) => n.rank)).toEqual([3, 7]);
    expect(sc.every((n) => n.ghost)).toBe(true);
    expect(net.clusters.find((c) => c.id === "sc")!.lines.join(" ")).toBe("Stem cells");
  });

  it("uses the fixed sizes from the design table", () => {
    const size = (variant: NetworkInput["variant"], layout: "wide" | "compact", n: number) => {
      const cs = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: `Field ${i}` }));
      const ns = cs.map((c, i) => ({ id: `n${i}`, cluster: c.id, rank: 1, isNew: false, verdict: null }));
      const net = buildNetwork({ variant, layout, clusters: cs, neurons: ns });
      return `${net.width}x${net.height}`;
    };
    expect(size("radar", "wide", 4)).toBe("608x232");
    expect(size("radar", "compact", 4)).toBe("350x184");
    expect(size("radar", "compact", 6)).toBe("350x292");
    expect(size("hero", "wide", 6)).toBe("608x192");
    expect(size("hero", "compact", 6)).toBe("350x292");
    expect(size("topic", "wide", 1)).toBe("608x120");
    expect(size("topic", "compact", 1)).toBe("350x104");
    expect(size("motif", "wide", 1)).toBe("220x112");
    expect(size("motif", "compact", 1)).toBe("220x112");
  });

  it("assigns hue and cell type from the cluster index mod 4, or the supplied index", () => {
    const net = buildNetwork(radar());
    expect(net.clusters.map((c) => c.hue)).toEqual([0, 1, 2, 3]);
    expect(net.clusters.map((c) => c.kind)).toEqual(["pyramidal", "stellate", "purkinje", "bipolar"]);
    const one = buildNetwork({
      variant: "topic",
      layout: "wide",
      clusters: [{ id: "t", label: "", index: 5 }],
      neurons: [{ id: "x", cluster: "t", rank: 1, isNew: false, verdict: null }],
    });
    expect(one.clusters[0].hue).toBe(1);
  });

  it("puts label under the hubs only when the variant shows labels", () => {
    expect(buildNetwork(radar()).clusters.every((c) => c.lines.length > 0)).toBe(true);
    const topic = buildNetwork(radar({ variant: "topic", clusters: clusters.slice(0, 1) }));
    expect(topic.clusters.every((c) => c.lines.length === 0)).toBe(true);
  });

  it("wraps a long label to two lines, and a single long word stays on one", () => {
    const cs = [
      { id: "a", label: "Brain-computer interfaces and more" },
      { id: "b", label: "Supercalifragilisticexpialidocious" },
      ...["c", "d", "e", "g"].map((id) => ({ id, label: id })),
    ];
    const net = buildNetwork(radar({ clusters: cs, neurons: [] }));
    expect(net.clusters[0].lines.length).toBe(2);
    expect(net.clusters[1].lines).toEqual(["Supercalifragilisticexpialidocious"]);
  });

  it("is seeded only from ids: positions do not depend on neighbours' order", () => {
    const a = buildNetwork(radar());
    const b = buildNetwork(radar({ neurons: [...neurons].reverse() }));
    const pos = (n: ReturnType<typeof buildNetwork>) => n.neurons.map((x) => [x.id, x.x, x.y]).sort();
    expect(pos(a)).toEqual(pos(b));
  });

  it("builds smooth cubic fibres that end at the hub, and records their length", () => {
    const net = buildNetwork(radar());
    for (const n of net.neurons) {
      const c = net.clusters.find((x) => x.id === n.cluster)!;
      expect(n.fibre).toMatch(/^M[\d.,-]+C/);
      expect(n.fibre.endsWith(`${c.hubX},${c.hubY}`)).toBe(true);
      expect(n.fibreLen).toBeGreaterThan(c.hubY - n.y - n.size * 1.2);
    }
  });
});

// ---------------------------------------------------------------------------
// Tracts, labels and tap targets (docs/design/brain.md section 5)
// ---------------------------------------------------------------------------

const PUBLIC_NAMES = [
  "Brain-computer interfaces",
  "Deep brain stimulation",
  "Neural engineering",
  "Neuromodulation",
  "Spinocerebellar ataxia",
  "Stem cells",
];
const FIXTURE_NAMES = ["Brain-computer interfaces", "Neural engineering", "Deep brain stimulation", "Stem cells"];

const named = (names: string[], count: number) =>
  names.slice(0, count).map((label, i) => ({ id: `f${i}`, label }));

/** A cubic "M x,y C x1,y1 x2,y2 x3,y3" sampled at `n` + 1 points. */
function sampleCubic(d: string, n = 60): [number, number][] {
  const v = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(v).toHaveLength(8);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    out.push([w[0] * v[0] + w[1] * v[2] + w[2] * v[4] + w[3] * v[6], w[0] * v[1] + w[1] * v[3] + w[2] * v[5] + w[3] * v[7]]);
  }
  return out;
}

/** Distance from a point to an axis-aligned box. */
function boxDistance(p: [number, number], b: { x0: number; x1: number; y0: number; y1: number }): number {
  const dx = Math.max(b.x0 - p[0], 0, p[0] - b.x1);
  const dy = Math.max(b.y0 - p[1], 0, p[1] - b.y1);
  return Math.hypot(dx, dy);
}

/**
 * The box a label line occupies, as a browser's getBBox reports it: sans 600 measures 0.47 to 0.55 em a
 * glyph (so 0.56 is a safe over-estimate), 1 em above the baseline and 0.3 em below it.
 */
function labelBoxes(net: ReturnType<typeof buildNetwork>) {
  const boxes: { x0: number; x1: number; y0: number; y1: number; text: string }[] = [];
  for (const c of net.clusters) {
    c.lines.forEach((line, k) => {
      const base = c.labelY + k * (net.labelPx + 2);
      const half = (line.length * 0.56 * net.labelPx) / 2;
      boxes.push({ x0: c.x - half, x1: c.x + half, y0: base - net.labelPx, y1: base + 0.3 * net.labelPx, text: line });
    });
  }
  return boxes;
}

describe("tract clearance (every variant, layout and cluster count)", () => {
  const cases: [string, "radar" | "hero", "wide" | "compact", string[], number][] = [];
  for (const [set, names] of [["public", PUBLIC_NAMES], ["fixture", FIXTURE_NAMES]] as const) {
    for (const variant of ["radar", "hero"] as const) {
      for (const layout of ["wide", "compact"] as const) {
        for (let count = 1; count <= names.length; count++) cases.push([`${set} ${count}`, variant, layout, names, count]);
      }
    }
  }
  it.each(cases)("%s fields, %s %s: every tract stays 6 px from every label, and every label stays in the box", (_name, variant, layout, names, count) => {
    const cs = named(names, count);
    const net = buildNetwork({ variant, layout, clusters: cs, neurons: variant === "hero" ? heroNeurons(cs) : [] });
    const boxes = labelBoxes(net);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.x0, b.text).toBeGreaterThanOrEqual(0);
      expect(b.x1, b.text).toBeLessThanOrEqual(net.width);
      expect(b.y1, b.text).toBeLessThanOrEqual(net.height);
    }
    for (const e of net.edges.filter((x) => x.kind === "axon")) {
      for (const p of sampleCubic(e.d)) {
        for (const b of boxes) expect(boxDistance(p, b), `${e.from}-${e.to} vs "${b.text}"`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("samples at least 40 points on every tract", () => {
    expect(sampleCubic("M0,0C10,10 20,10 30,0", 60).length).toBeGreaterThanOrEqual(40);
  });
});

describe("two-row layouts", () => {
  const build = (count: number, variant: "radar" | "hero" = "radar") => {
    const cs = named(PUBLIC_NAMES, count);
    return buildNetwork({ variant, layout: "compact", clusters: cs, neurons: variant === "hero" ? heroNeurons(cs) : [] });
  };
  const rows = (net: ReturnType<typeof buildNetwork>) => net.clusters.map((c) => Math.round(c.hubY));

  it("six clusters make 4 U tracts and 2 commissures, five make 3 and 1, and no tract leaves the box sideways", () => {
    for (const [count, u, commissures] of [[6, 4, 2], [5, 3, 1]] as const) {
      for (const variant of ["radar", "hero"] as const) {
        const net = build(count, variant);
        const axons = net.edges.filter((e) => e.kind === "axon");
        const byId = new Map(net.clusters.map((c) => [c.id, c]));
        const sameRow = axons.filter((e) => byId.get(e.from)!.hubY === byId.get(e.to)!.hubY);
        expect(sameRow).toHaveLength(u);
        expect(axons).toHaveLength(u + commissures);
        for (const e of axons) {
          for (const [x] of sampleCubic(e.d)) {
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(net.width);
          }
        }
      }
    }
  });

  it("runs both rows left to right on one column grid", () => {
    const net = build(6);
    expect(net.clusters.slice(0, 3).map((c) => c.x)).toEqual(net.clusters.slice(3).map((c) => c.x));
    expect(net.clusters.slice(0, 3).map((c) => c.x)).toEqual([...net.clusters.slice(0, 3).map((c) => c.x)].sort((a, b) => a - b));
    expect(new Set(rows(net)).size).toBe(2);
    const five = build(5);
    expect(five.clusters[3].x).toBe(five.clusters[0].x);
    expect(five.clusters[4].x).toBe(five.clusters[1].x);
  });

  it("breaks 'Neural engineering' onto two lines (label budget floor((cw - 28) / charW))", () => {
    const net = build(6);
    const ne = net.clusters.find((c) => c.label === "Neural engineering")!;
    expect(ne.lines).toEqual(["Neural", "engineering"]);
  });

  it("joins the two rows with an S that passes through the column boundary, low point to low point", () => {
    const net = build(6);
    const comm = net.edges.filter((e) => e.kind === "axon" && e.from !== e.to).filter((e) => {
      const a = net.clusters.find((c) => c.id === e.from)!;
      const b = net.clusters.find((c) => c.id === e.to)!;
      return a.hubY !== b.hubY;
    });
    expect(comm).toHaveLength(2);
    const [first] = sampleCubic(comm[0].d);
    const last = sampleCubic(comm[0].d).at(-1)!;
    expect(first[1]).toBeCloseTo(net.clusters[0].hubY + 10.5, 1);
    expect(last[1]).toBeCloseTo(net.clusters[3].hubY + 10.5, 1);
    expect(first[0]).toBeCloseTo((net.clusters[0].hubX + net.clusters[1].hubX) / 2, 1);
  });
});

describe("tap targets on the radar", () => {
  const real = (net: ReturnType<typeof buildNetwork>) => net.neurons.filter((n) => !n.ghost && !n.decorative);

  it("wide: max(soma + 6, 14), and none on a ghost or a decorative cell", () => {
    const net = buildNetwork(radar());
    for (const n of real(net)) expect(n.hit).toBeCloseTo(Math.max(n.size + 6, 14), 5);
    const dormant = buildNetwork(radar({ clusters: [], neurons: [] }));
    expect(dormant.neurons.every((n) => n.hit === 0)).toBe(true);
  });

  it("compact: every real cell has a target of at least 14 px, at most 22 px, and no two overlap", () => {
    const net = buildNetwork(radar({ layout: "compact" }));
    const cells = real(net);
    expect(cells).toHaveLength(neurons.length);
    for (const n of cells) {
      expect(n.hit).toBeGreaterThanOrEqual(14);
      expect(n.hit).toBeLessThanOrEqual(22);
    }
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const d = Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y);
        expect(cells[i].hit + cells[j].hit, `${cells[i].id} and ${cells[j].id}`).toBeLessThanOrEqual(d + 0.01);
      }
    }
  });

  it("compact: a lone cell gets the full 22 px", () => {
    const net = buildNetwork(radar({ layout: "compact", clusters: clusters.slice(0, 1), neurons: neurons.slice(0, 1) }));
    expect(real(net)[0].hit).toBe(22);
  });
});

describe("one field with every paper (the thin radar)", () => {
  it.each(["wide", "compact"] as const)("spreads ten cells across the ellipse with no two somas overlapping (%s)", (layout) => {
    const cs = clusters.slice(0, 1);
    const ns = neurons.map((n) => ({ ...n, cluster: "bci" }));
    const net = buildNetwork(radar({ layout, clusters: cs, neurons: ns }));
    expect(net.neurons).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        const a = net.neurons[i];
        const b = net.neurons[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id}`).toBeGreaterThan(a.size + b.size);
      }
    }
    const xs = net.neurons.map((n) => n.x);
    // The ellipse is wider than tall, so the cells use its width instead of piling into one disc.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.4 * net.clusters[0].rx);
  });
});

describe("the topic fan", () => {
  const topic = (layout: "wide" | "compact", count = 8) =>
    buildNetwork({
      variant: "topic",
      layout,
      clusters: [{ id: "t", label: "", index: 1 }],
      neurons: Array.from({ length: count }, (_, i) => ({ id: `4200000${i + 1}`, cluster: "t", rank: i + 1, isNew: i === 0, verdict: null })),
    });

  it.each([
    ["wide", 608, 120, 1.1],
    ["compact", 350, 104, 0.9],
  ] as const)("%s: %ix%i, scale %f, soma x increases with rank and soma radius decreases with rank", (layout, w, h, scale) => {
    const net = topic(layout);
    expect([net.width, net.height, net.scale]).toEqual([w, h, scale]);
    const byRank = [...net.neurons].sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < byRank.length; i++) {
      expect(byRank[i].x, `x of rank ${byRank[i].rank}`).toBeGreaterThan(byRank[i - 1].x);
      expect(byRank[i].size, `size of rank ${byRank[i].rank}`).toBeLessThan(byRank[i - 1].size);
    }
  });

  it("puts every fibre into one hub at the bottom centre and every soma inside the ellipse", () => {
    for (const layout of ["wide", "compact"] as const) {
      const net = topic(layout);
      const c = net.clusters[0];
      expect([c.hubX, c.hubY]).toEqual([net.width / 2, net.height]);
      expect(c.rx).toBe(layout === "wide" ? 200 : 140);
      for (const n of net.neurons) {
        expect(((n.x - c.x) / c.rx) ** 2 + ((n.y - c.y) / c.ry) ** 2).toBeLessThanOrEqual(1);
        expect(n.fibre.endsWith(`${c.hubX},${c.hubY}`)).toBe(true);
      }
    }
  });

  it("keeps fewer than eight cells in their own slots", () => {
    const net = topic("wide", 3);
    expect(net.neurons.map((n) => n.rank)).toEqual([1, 2, 3]);
    expect(net.neurons[2].x).toBeGreaterThan(net.neurons[0].x);
  });
});
