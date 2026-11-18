/**
 * Privacy contract rule 5 (docs/obsidian-bridge.md): public pages never
 * personalise. `/` and `/t/<slug>` must render nothing from sift.interests or
 * sift.ratings, for anyone, signed in or not. Two guards:
 *
 *   1. The import graph: no public page (or anything it imports, transitively)
 *      may reach a module that can read the private tables or a session.
 *   2. A render: with a private store full of sentinel interests and ratings
 *      mocked in, the rendered HTML contains none of them.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ENTRIES = ["app/page.tsx", "app/t/[slug]/page.tsx", "app/layout.tsx"];
const PRIVATE = [
  "lib/me-api.ts",
  "lib/me-context.ts",
  "lib/radar-store.ts",
  "lib/access.ts",
  "lib/auth-server.ts",
  "lib/personal.ts",
  "components/me/",
];

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = base + ext;
    if (existsSync(f) && !f.endsWith("/")) {
      try {
        readFileSync(f);
        return f;
      } catch {
        // a directory
      }
    }
  }
  return null;
}

function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [path.join(ROOT, entry)];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const target = resolveImport(file, m[1] ?? m[2]);
      if (target) stack.push(target);
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f)));
}

describe("public pages never reach private data (import graph)", () => {
  for (const entry of PUBLIC_ENTRIES) {
    it(`${entry} imports nothing that can read interests, ratings or a session`, () => {
      const graph = importGraph(entry);
      expect(graph.size).toBeGreaterThan(1);
      for (const f of graph) {
        for (const p of PRIVATE) expect(f.startsWith(p), `${entry} reaches ${f}`).toBe(false);
      }
    });
  }

  it("the graph walker does see a private module when one is imported", () => {
    // Guards the guard: /me does import the private modules.
    const graph = importGraph("app/me/page.tsx");
    expect([...graph]).toContain("lib/me-api.ts");
    expect([...graph]).toContain("lib/radar-store.ts");
  });
});

// ---------------------------------------------------------------------------
// The render
// ---------------------------------------------------------------------------

const SENTINEL_TERM = "zzsentinelinterestterm";
const SENTINEL_PMID = "99999999";

const feed = {
  topic: "neuromodulation",
  id: "neuromodulation",
  name: "Neuromodulation",
  query: "q",
  updatedAt: "2026-11-12T06:00:00Z",
  papers: [
    {
      id: "41000001", pmid: "41000001", title: "A public paper", journal: "Brain", authorsShort: "Doe et al.",
      published: "2026-11-10T00:00:00Z", doi: null, url: null, score: 0.5, orderScore: 70, summary: null, reasons: ["review"],
    },
  ],
};

vi.mock("@/lib/page-data", () => ({
  loadFeed: vi.fn(async () => ({ data: feed, error: null })),
  loadTopics: vi.fn(async () => ({ data: [{ slug: "neuromodulation", name: "Neuromodulation", description: null }], error: null })),
  freshness: () => "just now",
}));

// If anything on a public page ever did reach for the private store, it would
// find these rows.
vi.mock("@/lib/radar-store", () => ({
  getRadarStore: () => ({
    listInterests: async () => [{ term: SENTINEL_TERM, weight: 1, source: "obsidian" }],
    getRatings: async () => new Map([[SENTINEL_PMID, 1]]),
  }),
}));

describe("public pages never render interests or ratings (render)", () => {
  async function html(el: Promise<React.ReactElement> | React.ReactElement) {
    return renderToStaticMarkup(await el);
  }

  it("/ shows the public feed and nothing personal", async () => {
    const { default: Home } = await import("@/app/page");
    const out = await html(Home());
    expect(out).toContain("A public paper");
    for (const s of [SENTINEL_TERM, SENTINEL_PMID, "matches your interest", "you muted", "My radar", "👍", "👎"]) {
      expect(out).not.toContain(s);
    }
  });

  it("/ draws the hero map from the public topic names, and the map is hidden from assistive technology", async () => {
    const { default: Home } = await import("@/app/page");
    const out = await html(Home());
    expect(out).toMatch(/<div[^>]*aria-hidden="true"[^>]*class="brain brain-hero/);
    expect(out).toContain("Neuromodulation</text>");
    expect(out).toContain("1 field · illustration, not live data");
    expect(out).not.toContain("data-pmid");
    expect(out).not.toContain("data-verdict");
  });

  it("/t/<slug> draws a topic map whose cells are public papers and carry no verdict", async () => {
    const { default: TopicPage } = await import("@/app/t/[slug]/page");
    const out = await html(TopicPage({ params: Promise.resolve({ slug: "neuromodulation" }) } as never));
    expect(out).toContain('data-pmid="41000001"');
    expect(out).not.toContain("data-verdict");
  });

  it("/t/<slug> shows the public feed and nothing personal", async () => {
    const { default: TopicPage } = await import("@/app/t/[slug]/page");
    const out = await html(TopicPage({ params: Promise.resolve({ slug: "neuromodulation" }) } as never));
    expect(out).toContain("A public paper");
    for (const s of [SENTINEL_TERM, SENTINEL_PMID, "matches your interest", "you muted", "My radar", "👍", "👎"]) {
      expect(out).not.toContain(s);
    }
  });
});
