import { describe, expect, it } from "vitest";
import { heroModel, motifModel, topicCaption, topicIndex, topicModel, TOPIC_MAP_PAPERS } from "./public-model";

const topics = [
  { slug: "bci", name: "Brain-computer interfaces" },
  { slug: "dbs", name: "Deep brain stimulation" },
  { slug: "stem-cells", name: "Stem cells" },
];
const NOW = new Date("2026-11-18T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe("topicIndex", () => {
  it("is the slug's place in the topic list, 0 when unknown or when topics failed to load", () => {
    expect(topicIndex("stem-cells", topics)).toBe(2);
    expect(topicIndex("nope", topics)).toBe(0);
    expect(topicIndex("dbs", null)).toBe(0);
  });
});

describe("heroModel", () => {
  it("makes one labelled cluster per topic and three decorative cells each, with no state", () => {
    const m = heroModel(topics);
    expect(m.clusters.map((c) => c.label)).toEqual(topics.map((t) => t.name));
    expect(m.neurons).toHaveLength(9);
    for (const n of m.neurons) {
      expect(n.decorative).toBe(true);
      expect(n.isNew).toBe(false);
      expect(n.verdict).toBeNull();
    }
  });

  it("says it is an illustration and pluralises", () => {
    expect(heroModel(topics).caption).toBe("3 fields · illustration, not live data");
    expect(heroModel(topics.slice(0, 1)).caption).toBe("1 field · illustration, not live data");
  });
});

describe("topicModel", () => {
  const papers = Array.from({ length: 12 }, (_, i) => ({ pmid: `p${i}`, published: hoursAgo(i === 1 ? 10 : 400) }));

  it("takes the top papers only, in rank order, and marks the recent ones new", () => {
    const m = topicModel({ slug: "dbs", papers, topics, now: NOW });
    expect(m.neurons).toHaveLength(TOPIC_MAP_PAPERS);
    expect(m.neurons.map((n) => n.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.neurons.filter((n) => n.isNew).map((n) => n.id)).toEqual(["p1"]);
  });

  it("uses the slug's index for the hue, so a topic has one colour on / and on its page", () => {
    expect(topicModel({ slug: "stem-cells", papers, topics, now: NOW }).clusters[0].index).toBe(2);
    expect(topicModel({ slug: "stem-cells", papers, topics: null, now: NOW }).hue).toBe(0);
  });

  it("never carries a verdict", () => {
    expect(topicModel({ slug: "dbs", papers, topics, now: NOW }).neurons.every((n) => n.verdict === null)).toBe(true);
  });
});

describe("motifModel", () => {
  it("is three decorative cells in one unlabelled cluster", () => {
    const m = motifModel();
    expect(m.clusters).toEqual([{ id: "motif", label: "", index: 0 }]);
    expect(m.neurons).toHaveLength(3);
  });
});

describe("topicCaption and topicModel counts", () => {
  it("says top 8 of N, or all N when the page has eight or fewer", () => {
    expect(topicCaption(20)).toBe("top 8 of 20 papers");
    expect(topicCaption(9)).toBe("top 8 of 9 papers");
    expect(topicCaption(8)).toBe("all 8 papers");
    expect(topicCaption(5)).toBe("all 5 papers");
    expect(topicCaption(1)).toBe("all 1 paper");
  });
  it("counts the new papers among the drawn cells, and the whole page as the total", () => {
    const papers = Array.from({ length: 12 }, (_, i) => ({ pmid: `5000000${i}`.slice(0, 8), published: i === 1 || i === 10 ? hoursAgo(5) : hoursAgo(24 * 20) }));
    const m = topicModel({ slug: "bci", papers, topics, now: NOW });
    expect(m.total).toBe(12);
    expect(m.neurons).toHaveLength(TOPIC_MAP_PAPERS);
    expect(m.newCount).toBe(1); // the second paper is drawn, the eleventh is not
  });
});
