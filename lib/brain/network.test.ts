import { describe, expect, it } from "vitest";
import { buildNetwork, isNew, type NetworkInput } from "./network";

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

  it("keeps every neuron inside its cluster's radius", () => {
    for (const layout of ["wide", "compact"] as const) {
      const net = buildNetwork(radar({ layout }));
      const byId = new Map(net.clusters.map((c) => [c.id, c]));
      for (const n of net.neurons) {
        const c = byId.get(n.cluster)!;
        expect(Math.hypot(n.x - c.x, n.y - c.y) + n.size).toBeLessThanOrEqual(c.r + 0.01);
      }
    }
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

  it("gives a lower rank a larger size, from 7 px at rank 1 to 3.4 px at rank 10 (scale 1)", () => {
    const net = buildNetwork(radar());
    const size = (id: string) => net.neurons.find((n) => n.id === id)!.size;
    expect(size("40000001")).toBeCloseTo(7, 5);
    expect(size("40000010")).toBeCloseTo(3.4, 5);
    expect(size("40000001")).toBeGreaterThan(size("40000002"));
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
      expect(net.height).toBe(layout === "wide" ? 232 : 172);
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
    expect(size("radar", "compact", 4)).toBe("350x172");
    expect(size("radar", "compact", 6)).toBe("350x292");
    expect(size("hero", "wide", 6)).toBe("608x192");
    expect(size("hero", "compact", 6)).toBe("350x292");
    expect(size("topic", "wide", 1)).toBe("240x168");
    expect(size("topic", "compact", 1)).toBe("350x140");
    expect(size("motif", "wide", 1)).toBe("200x104");
    expect(size("motif", "compact", 1)).toBe("200x104");
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
