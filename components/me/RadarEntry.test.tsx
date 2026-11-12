import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import RadarEntry from "./RadarEntry";
import type { MePaper } from "@/lib/me-api";

const paper: MePaper = {
  id: "41000001",
  pmid: "41000001",
  title: "Adaptive BCI in a glia model",
  journal: "Brain",
  authorsShort: "Doe et al.",
  published: "2026-11-10T00:00:00Z",
  doi: null,
  url: null,
  score: 0.506,
  orderScore: 86,
  h1: 66,
  h1Quality: 0.6,
  summary: null,
  reasons: ["matches your interest: bci", "review"],
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
    expect(html.indexOf("matches your interest: bci")).toBeLessThan(html.indexOf("review"));
  });

  it("shows the current verdict as a pressed thumb", () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Useful to me"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Not for me"/);
  });
});

describe("RadarEntry taps", () => {
  it("disables both thumbs while a rating is in flight, so a double tap sends one request", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((res) => (release = res)));
    vi.stubGlobal("fetch", fetchMock);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<RadarEntry paper={{ ...paper, verdict: null }} />));

    const up = el.querySelector('button[aria-label="Useful to me"]') as HTMLButtonElement;
    const down = el.querySelector('button[aria-label="Not for me"]') as HTMLButtonElement;
    await act(async () => up.click());
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    await act(async () => down.click());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => release(new Response("{}", { status: 200 })));
    expect(up.disabled).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("true");
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});

