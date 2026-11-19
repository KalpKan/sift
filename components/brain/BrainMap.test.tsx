import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BrainMap from "./BrainMap";
import BrainMaps from "./BrainMaps";
import { buildNetwork, heroNeurons, motifNeurons, type NetworkInput } from "@/lib/brain/network";

const clusters = [
  { id: "bci", label: "Brain-computer interfaces" },
  { id: "dbs", label: "Deep brain stimulation" },
  { id: "sc", label: "Stem cells" },
];
const neurons: NetworkInput["neurons"] = [
  { id: "40000001", cluster: "bci", rank: 1, isNew: true, verdict: null },
  { id: "40000002", cluster: "bci", rank: 2, isNew: false, verdict: 1 },
  { id: "40000003", cluster: "dbs", rank: 3, isNew: true, verdict: -1 },
  { id: "40000004", cluster: "sc", rank: 4, isNew: false, verdict: null },
];
const radar = (over: Partial<NetworkInput> = {}) =>
  buildNetwork({ variant: "radar", layout: "wide", clusters, neurons, ...over });

const render = (net = radar(), variant: "radar" | "hero" | "topic" | "motif" = "radar") =>
  renderToStaticMarkup(<BrainMap network={net} variant={variant} height={net.height} />);

describe("BrainMap", () => {
  it("renders one [data-pmid] per paper neuron", () => {
    const html = render();
    expect(html.match(/data-pmid="/g)).toHaveLength(neurons.length);
  });

  it("is aria-hidden with a fixed height, so nothing shifts before hydration", () => {
    const html = render();
    expect(html).toMatch(/^<div[^>]*aria-hidden="true"/);
    expect(html).toMatch(/^<div[^>]*style="[^"]*height:232px/);
  });

  it("renders identical markup twice (no randomness or clock in markup)", () => {
    expect(render()).toBe(render());
  });

  it("carries verdict and new state in data attributes", () => {
    const html = render();
    expect(html).toMatch(/data-pmid="40000002"[^>]*data-verdict="1"/);
    expect(html).toMatch(/data-pmid="40000003"[^>]*data-verdict="-1"/);
    expect(html).toMatch(/data-pmid="40000001"[^>]*data-new="true"/);
    expect(html).toMatch(/data-pmid="40000004"[^>]*data-new="false"/);
    expect(html).not.toMatch(/data-pmid="40000001"[^>]*data-verdict/);
  });

  it("draws the steady glow disc for new cells so reduced motion and pre-hydration show them", () => {
    const html = render();
    expect(html.match(/class="brain-glow"/g)).toHaveLength(2); // both new cells; CSS hides the 👎 one
  });

  it("variant hero draws cluster labels and no paper data", () => {
    const cs = clusters;
    const net = buildNetwork({ variant: "hero", layout: "wide", clusters: cs, neurons: heroNeurons(cs) });
    const html = render(net, "hero");
    expect(html.match(/<text /g)).toHaveLength(3);
    expect(html).toContain("Brain-computer interfaces");
    expect(html).not.toContain("data-pmid");
    expect(html).not.toContain("data-verdict");
    expect(html).not.toContain("brain-ring-new");
  });

  it("topic and motif draw no labels", () => {
    const one = [{ id: "t", label: "Neuromodulation" }];
    const topic = buildNetwork({ variant: "topic", layout: "wide", clusters: one, neurons: [{ id: "p1", cluster: "t", rank: 1, isNew: true, verdict: null }] });
    expect(render(topic, "topic")).not.toContain("<text");
    const motif = buildNetwork({ variant: "motif", layout: "wide", clusters: [{ id: "motif", label: "" }], neurons: motifNeurons() });
    expect(render(motif, "motif")).not.toContain("<text");
  });

  it("renders the dormant map for no clusters, in the wire colour, without a label or a paper", () => {
    const html = render(radar({ clusters: [], neurons: [] }));
    expect(html).not.toContain("<text");
    expect(html).not.toContain("data-pmid");
    expect(html).toContain("is-dormant");
    expect(html).toContain('height:232px');
  });

  it("gives a followed field with no papers its label and ghost cells", () => {
    const html = render(radar({ neurons: neurons.filter((n) => n.cluster !== "sc") }));
    expect(html).toContain("Stem cells");
    expect(html.match(/data-pmid="/g)).toHaveLength(3);
  });

  it("escapes labels", () => {
    const html = render(radar({ clusters: [{ id: "x", label: "<b>&" }], neurons: [] }));
    expect(html).toContain("&lt;b&gt;&amp;");
  });
});

describe("BrainMaps", () => {
  it("builds both layouts, switched by CSS, each with its own fixed height", () => {
    const html = renderToStaticMarkup(<BrainMaps variant="radar" clusters={clusters} neurons={neurons} />);
    expect(html).toContain("hidden sm:block");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("height:232px");
    expect(html).toContain("height:184px");
    expect(html).toContain('viewBox="0 0 608 232"');
    expect(html).toContain('viewBox="0 0 350 184"');
  });

  it("renders with no clusters and no neurons (zero followed fields)", () => {
    const html = renderToStaticMarkup(<BrainMaps variant="radar" clusters={[]} neurons={[]} />);
    expect(html).toContain("is-dormant");
  });
});
