import { describe, expect, it } from "vitest";
import { DEV_NOW, DEV_RADAR_FEED, DEV_TOPICS } from "@/lib/dev-fixtures";
import { radarModel } from "./radar-model";

const fields = DEV_TOPICS.filter((t) => t.followed).map((t) => ({ slug: t.slug, name: t.name }));

describe("radarModel", () => {
  const m = radarModel({ fields, papers: DEV_RADAR_FEED.papers, now: DEV_NOW });

  it("makes one cluster per followed field, in order, with its name as the label", () => {
    expect(m.clusters.map((c) => c.id)).toEqual(["bci", "neural-engineering", "dbs", "stem-cells"]);
    expect(m.clusters[0].label).toBe("Brain-computer interfaces");
  });

  it("makes one neuron per paper, ranked by shown rank, with its rating", () => {
    expect(m.neurons).toHaveLength(10);
    expect(m.neurons[0]).toMatchObject({ id: "40000001", cluster: "bci", rank: 1, isNew: true, verdict: null });
    expect(m.neurons.find((n) => n.id === "40000002")!.verdict).toBe(1);
    expect(m.neurons.find((n) => n.id === "40000006")!.verdict).toBe(-1);
  });

  it("counts the papers published in the last 48 hours as new", () => {
    expect(m.newCount).toBe(3);
  });

  it("gives each row its field's hue index, name and new flag", () => {
    const row = m.rows.find((r) => r.paper.pmid === "40000003")!;
    expect(row).toMatchObject({ hue: 1, topicName: "Neural engineering", isNew: true });
    expect(m.rows.find((r) => r.paper.pmid === "40000004")!.isNew).toBe(false);
  });

  it("ignores a paper whose field is not followed", () => {
    const out = radarModel({ fields: fields.slice(0, 1), papers: DEV_RADAR_FEED.papers, now: DEV_NOW });
    expect(out.neurons.every((n) => n.cluster === "bci")).toBe(true);
    expect(out.rows.every((r) => r.paper.topic === "bci")).toBe(true);
  });

  it("handles no fields and no papers", () => {
    expect(radarModel({ fields: [], papers: [], now: DEV_NOW })).toMatchObject({ clusters: [], neurons: [], rows: [], newCount: 0 });
  });
});
