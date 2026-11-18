import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import RadarEntry from "./RadarEntry";
import BrainMap from "@/components/brain/BrainMap";
import { BrainHoverProvider, useBrainHover } from "@/components/brain/BrainHover";
import { buildNetwork } from "@/lib/brain/network";
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


describe("RadarEntry anatomy", () => {
  it("has a row anchor and leads the reasons with the word new for a new paper", () => {
    const html = renderToStaticMarkup(<RadarEntry paper={paper} isNew hue={1} topicName="Neural engineering" />);
    expect(html).toContain('id="paper-41000001"');
    expect(html.indexOf(">new<")).toBeGreaterThan(-1);
    expect(html.indexOf(">new<")).toBeLessThan(html.indexOf("matches your interest: bci"));
    expect(html).toContain("Neural engineering");
    expect(html).toContain("var(--cluster-2)");
  });

  it("says nothing about new for an older paper", () => {
    const html = renderToStaticMarkup(<RadarEntry paper={paper} />);
    expect(html).not.toContain(">new<");
  });
});

describe("RadarEntry and the map", () => {
  function mount(verdict: 1 | -1 | null) {
    const net = buildNetwork({
      variant: "radar",
      layout: "wide",
      clusters: [{ id: "deep-brain-stimulation", label: "Deep brain stimulation" }],
      neurons: [{ id: "41000001", cluster: "deep-brain-stimulation", rank: 1, isNew: true, verdict }],
    });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    let seen: string | null = null;
    function Probe() {
      seen = useBrainHover().active;
      return null;
    }
    const render = () =>
      act(async () =>
        root.render(
          <BrainHoverProvider>
            <BrainMap network={net} variant="radar" height={net.height} />
            <RadarEntry paper={{ ...paper, verdict }} isNew hue={0} />
            <Probe />
          </BrainHoverProvider>,
        ),
      );
    return { el, root, render, active: () => seen };
  }
  const neuron = (el: HTMLElement) => el.querySelector("[data-pmid]") as SVGGElement;

  it("restores the previous verdict on the button and on the map neuron when a rating fails (Review Focus 3)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
    vi.stubGlobal("fetch", fetchMock);
    const m = mount(-1);
    await m.render();
    const up = m.el.querySelector('button[aria-label="Useful to me"]') as HTMLButtonElement;
    const down = m.el.querySelector('button[aria-label="Not for me"]') as HTMLButtonElement;
    expect(neuron(m.el).getAttribute("data-verdict")).toBe("-1");
    expect(down.getAttribute("aria-pressed")).toBe("true");

    await act(async () => up.click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(neuron(m.el).getAttribute("data-verdict")).toBe("-1");
    expect(down.getAttribute("aria-pressed")).toBe("true");
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(m.el.textContent).toContain("Not saved. Try again.");
    act(() => m.root.unmount());
    vi.unstubAllGlobals();
  });

  it("shows an unsaved rating on the map while the request is in flight, and keeps it once saved", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((res) => (release = res))));
    const m = mount(-1);
    await m.render();
    const up = m.el.querySelector('button[aria-label="Useful to me"]') as HTMLButtonElement;
    await act(async () => up.click());
    expect(neuron(m.el).getAttribute("data-verdict")).toBe("1");
    await act(async () => release(new Response("{}", { status: 200 })));
    expect(neuron(m.el).getAttribute("data-verdict")).toBe("1");
    expect(up.getAttribute("aria-pressed")).toBe("true");
    act(() => m.root.unmount());
    vi.unstubAllGlobals();
  });

  it("removes the map's verdict when a failed rating rolls back to none", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const m = mount(null);
    await m.render();
    expect(neuron(m.el).hasAttribute("data-verdict")).toBe(false);
    const up = m.el.querySelector('button[aria-label="Useful to me"]') as HTMLButtonElement;
    await act(async () => up.click());
    expect(neuron(m.el).hasAttribute("data-verdict")).toBe(false);
    act(() => m.root.unmount());
    vi.unstubAllGlobals();
  });

  it("lights the cell and the field label while the row is hovered, and clears on leave", async () => {
    const m = mount(null);
    await m.render();
    const row = m.el.querySelector("#paper-41000001") as HTMLElement;
    await act(async () => row.dispatchEvent(new MouseEvent("pointerover", { bubbles: true })));
    expect(m.active()).toBe("41000001");
    expect(neuron(m.el).hasAttribute("data-hl")).toBe(true);
    expect(m.el.querySelector(".brain")!.classList.contains("is-hover")).toBe(true);
    expect(m.el.querySelector(".brain-label")!.hasAttribute("data-hl")).toBe(true);
    await act(async () => row.dispatchEvent(new MouseEvent("pointerout", { bubbles: true })));
    expect(m.active()).toBeNull();
    expect(neuron(m.el).hasAttribute("data-hl")).toBe(false);
    act(() => m.root.unmount());
  });

  it("highlights the row, and scrolls to it, when its cell is clicked", async () => {
    const m = mount(null);
    await m.render();
    const scroll = vi.fn();
    (m.el.querySelector("#paper-41000001") as HTMLElement).scrollIntoView = scroll;
    await act(async () => neuron(m.el).querySelector(".brain-hit")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
    expect(m.active()).toBe("41000001");
    expect((m.el.querySelector("#paper-41000001") as HTMLElement).className).toContain("bg-surface");
    act(() => m.root.unmount());
  });
});
