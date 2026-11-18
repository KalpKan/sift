import type { MePaper } from "@/lib/me-api";
import { isNew, type NetworkInput } from "./network";

export type RadarField = { slug: string; name: string };

/**
 * The radar's map and its list from one source: a cluster per followed field
 * (in the order the topics are listed, which sets the hue), a neuron per
 * listed paper in the cluster of its `topic`, and for each paper the extras its
 * row needs. `now` is passed in so nothing here reads the clock.
 */
export function radarModel({ fields, papers, now }: { fields: RadarField[]; papers: MePaper[]; now: Date }) {
  const index = new Map(fields.map((f, i) => [f.slug, i]));
  const shown = papers.filter((p) => index.has(p.topic));
  const rows = shown.map((paper) => ({
    paper,
    hue: (index.get(paper.topic) as number) % 4,
    topicName: fields[index.get(paper.topic) as number].name,
    isNew: isNew(paper.published, now),
  }));
  const clusters: NetworkInput["clusters"] = fields.map((f) => ({ id: f.slug, label: f.name }));
  const neurons: NetworkInput["neurons"] = rows.map((r) => ({
    id: r.paper.pmid,
    cluster: r.paper.topic,
    rank: r.paper.shownRank,
    isNew: r.isNew,
    verdict: r.paper.verdict,
  }));
  return { clusters, neurons, rows, newCount: rows.filter((r) => r.isNew).length };
}
