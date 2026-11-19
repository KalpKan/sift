import { describe, expect, it } from "vitest";
import { rng } from "./network";
import { MAX_DASHES, PATTERNS, pickNext, restRange, spikesFor, tripMs } from "./firing";

const cell = (id: string, over: Partial<Parameters<typeof pickNext>[0]["cells"][number]> = {}) => ({
  id,
  isNew: true,
  verdict: null,
  ghost: false,
  ...over,
});

describe("firing patterns", () => {
  it("gives each cell type its own pattern", () => {
    expect(PATTERNS.pyramidal).toEqual({ spikes: 1, gapMs: 0, speed: 1 });
    expect(PATTERNS.stellate).toEqual({ spikes: 2, gapMs: 140, speed: 1 });
    expect(PATTERNS.purkinje).toEqual({ spikes: 3, gapMs: 110, speed: 1 });
    expect(PATTERNS.bipolar).toEqual({ spikes: 1, gapMs: 0, speed: 0.7 });
  });

  it("never needs more than the three dashes allowed on screen", () => {
    expect(MAX_DASHES).toBe(3);
    for (const p of Object.values(PATTERNS)) expect(p.spikes).toBeLessThanOrEqual(MAX_DASHES);
  });

  it("makes the motif fire a single spike whatever the cell type", () => {
    expect(spikesFor("motif", "purkinje")).toBe(1);
    expect(spikesFor("radar", "purkinje")).toBe(3);
  });
});

describe("tripMs", () => {
  it("is length over 170 px/s, clamped to 380..900 ms", () => {
    expect(tripMs(85)).toBe(500);
    expect(tripMs(10)).toBe(380);
    expect(tripMs(400)).toBe(900);
  });
  it("is slower for a bipolar cell and faster for a burst", () => {
    expect(tripMs(85, 0.7)).toBeCloseTo(714.3, 0);
    expect(tripMs(110, 1, 220)).toBe(500);
  });
});

describe("restRange", () => {
  it("is 3-7 s on the radar and topic, 4-9 s on the hero, 6-10 s on the motif", () => {
    expect(restRange("radar")).toEqual([3000, 7000]);
    expect(restRange("topic")).toEqual([3000, 7000]);
    expect(restRange("hero")).toEqual([4000, 9000]);
    expect(restRange("motif")).toEqual([6000, 10000]);
  });
});

describe("pickNext", () => {
  const base = { variant: "radar" as const, lastId: null, lastFiredAt: {}, now: 100_000, rng: rng("t") };

  it("fires only new cells that are not 👎, and never ghosts", () => {
    const cells = [cell("a", { isNew: false }), cell("b", { verdict: -1 }), cell("c", { ghost: true }), cell("d")];
    for (let i = 0; i < 20; i++) expect(pickNext({ ...base, rng: rng(`s${i}`), cells })?.id).toBe("d");
  });

  it("does nothing when no cell is new (no ambient motion)", () => {
    expect(pickNext({ ...base, cells: [cell("a", { isNew: false })] })).toBeNull();
    expect(pickNext({ ...base, cells: [] })).toBeNull();
  });

  it("lets the hero and motif fire any non-ghost cell", () => {
    const cells = [cell("a", { isNew: false }), cell("g", { ghost: true })];
    expect(pickNext({ ...base, variant: "hero", cells })?.id).toBe("a");
    expect(pickNext({ ...base, variant: "motif", cells })?.id).toBe("a");
  });

  it("does not fire the same cell twice in a row when another candidate exists", () => {
    const cells = [cell("a"), cell("b")];
    for (let i = 0; i < 30; i++) expect(pickNext({ ...base, rng: rng(`s${i}`), lastId: "a", cells })?.id).toBe("b");
  });

  it("fires the same cell again when it is the only candidate", () => {
    expect(pickNext({ ...base, lastId: "a", cells: [cell("a")] })?.id).toBe("a");
  });

  it("keeps a cell at rest for 8 s between its own events", () => {
    const next = pickNext({ ...base, lastId: "a", lastFiredAt: { a: 98_000 }, cells: [cell("a")] });
    // Fired 2 s ago, so it must wait until 106 s: at least 6 s from now, and at least the rest range.
    expect(next!.delayMs).toBeGreaterThanOrEqual(8000 - 2000);
  });

  it("waits a rest inside the variant's range when nothing else holds it back", () => {
    for (let i = 0; i < 30; i++) {
      const d = pickNext({ ...base, rng: rng(`r${i}`), cells: [cell("a")] })!.delayMs;
      expect(d).toBeGreaterThanOrEqual(3000);
      expect(d).toBeLessThanOrEqual(7000);
    }
  });

  it("is deterministic for a seed", () => {
    const cells = [cell("a"), cell("b"), cell("c")];
    expect(pickNext({ ...base, rng: rng("x"), cells })).toEqual(pickNext({ ...base, rng: rng("x"), cells }));
  });
});
