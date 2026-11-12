import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RadarEntry from "./RadarEntry";
import type { MePaper } from "@/lib/me-api";

const paper: MePaper = {
  id: "41000001",
  pmid: "41000001",
  title: "Adaptive DBS in Parkinson disease",
  journal: "Brain",
  authorsShort: "Doe et al.",
  published: "2026-11-10T00:00:00Z",
  doi: null,
  url: null,
  score: 0.6,
  orderScore: 86,
  summary: null,
  reasons: ["matches your interest: dbs", "review"],
  topic: "deep-brain-stimulation",
  shownRank: 1,
  recencyRank: 4,
  rankerVersion: "p1",
  verdict: 1,
};

describe("RadarEntry", () => {
  const html = renderToStaticMarkup(<RadarEntry paper={paper} />);

  it("links to PubMed when there is no DOI", () => {
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/41000001/"');
  });

  it("shows why it ranked, interest matches first", () => {
    expect(html.indexOf("matches your interest: dbs")).toBeLessThan(html.indexOf("review"));
  });

  it("shows the current verdict as a pressed thumb", () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Useful to me"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Not for me"/);
  });
});
