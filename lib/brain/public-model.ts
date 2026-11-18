import { isNew, heroNeurons, motifNeurons, type NetworkInput } from "./network";

/**
 * The maps on the public pages (`/`, `/t/<slug>`, `/sign-in`). They read topic
 * names, PMIDs and publication dates and nothing else: no interests, ratings
 * or follows (lib/public-pages.test.ts guards the import graph), so every
 * neuron here has `verdict: null`.
 */

type TopicRef = { slug: string; name: string };

/** A topic's position in `loadTopics()` order, which sets its colour and cell type everywhere. 0 if unknown. */
export function topicIndex(slug: string, topics: TopicRef[] | null | undefined): number {
  const i = (topics ?? []).findIndex((t) => t.slug === slug);
  return i < 0 ? 0 : i;
}

/** `/`: one labelled cluster per public topic, with three decorative cells each. */
export function heroModel(topics: TopicRef[]) {
  const clusters: NetworkInput["clusters"] = topics.map((t) => ({ id: t.slug, label: t.name }));
  return {
    clusters,
    neurons: heroNeurons(clusters),
    caption: `${topics.length} field${topics.length === 1 ? "" : "s"} · illustration, not live data`,
  };
}

export const TOPIC_MAP_PAPERS = 8;

/** `/t/<slug>`: one unlabelled cluster of the page's top papers; a paper from the last 48 hours is new. */
export function topicModel({
  slug,
  papers,
  topics,
  now,
}: {
  slug: string;
  papers: { pmid: string; published: string }[];
  topics: TopicRef[] | null | undefined;
  now: Date;
}) {
  const index = topicIndex(slug, topics);
  const clusters: NetworkInput["clusters"] = [{ id: slug, label: "", index }];
  const neurons: NetworkInput["neurons"] = papers.slice(0, TOPIC_MAP_PAPERS).map((p, i) => ({
    id: p.pmid,
    cluster: slug,
    rank: i + 1,
    isNew: isNew(p.published, now),
    verdict: null,
  }));
  return { hue: index % 4, clusters, neurons };
}

/** `/sign-in`: one unlabelled cluster of three decorative cells, in slot 1. */
export function motifModel() {
  const clusters: NetworkInput["clusters"] = [{ id: "motif", label: "", index: 0 }];
  return { clusters, neurons: motifNeurons("motif") };
}
