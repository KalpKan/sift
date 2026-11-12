import { describe, expect, it } from "vitest";
import { GATE, evaluate, formatReport, precisionAt, type RatedPaper } from "./eval";
import { POINTS_PER_WEIGHT, TAP_STEP } from "./personal";

function rated(pmid: string, verdict: 1 | -1, over: Partial<RatedPaper> = {}): RatedPaper {
  return { pmid, verdict, title: `Paper ${pmid}`, journal: null, h1: 50, publishedMs: Number(pmid), ...over };
}

describe("precisionAt", () => {
  it("is the share of thumbs-up in the first k, or in all of them when fewer than k", () => {
    const xs = [rated("1", 1), rated("2", -1), rated("3", 1), rated("4", 1)];
    expect(precisionAt(xs, 3)).toBeCloseTo(2 / 3);
    expect(precisionAt(xs, 10)).toBeCloseTo(3 / 4);
    expect(precisionAt([], 3)).toBeNull();
  });
});

describe("evaluate", () => {
  it("orders newest-first by date and h1 by the stored score", () => {
    const xs = [rated("10", -1, { h1: 90 }), rated("30", 1, { h1: 10 }), rated("20", 1, { h1: 50 })];
    const r = evaluate(xs, []);
    expect(r.methods.newest.order).toEqual(["30", "20", "10"]);
    expect(r.methods.h1.order).toEqual(["10", "20", "30"]);
    expect(r.methods.newest.p3).toBeCloseTo(2 / 3);
    expect(r.n).toBe(3);
    expect(r.positives).toBe(2);
  });

  it("p1 uses the Obsidian and hand-typed terms", () => {
    const xs = [rated("1", -1, { h1: 60 }), rated("2", 1, { h1: 50, title: "DBS in PD" })];
    const r = evaluate(xs, [{ term: "dbs", weight: 0.5, source: "obsidian" }]);
    expect(r.methods.p1.order).toEqual(["2", "1"]);
  });

  it("p1's tap learning is leave-one-out: a paper's own tap never helps rank it", () => {
    // Only paper 2 matches "seeg", and only paper 2 was tapped up. In-sample,
    // its own tap would lift it; leave-one-out, nothing else taught "seeg".
    const xs = [rated("1", 1, { h1: 60 }), rated("2", 1, { h1: 59, title: "SEEG mapping" })];
    const r = evaluate(xs, [{ term: "seeg", weight: 0, source: "taps" }]);
    expect(r.methods.p1.order).toEqual(["1", "2"]);
  });

  it("p1 does learn from the OTHER taps", () => {
    const xs = [
      rated("1", 1, { h1: 70 }),
      rated("2", 1, { h1: 40, title: "SEEG one" }),
      rated("3", 1, { h1: 40, title: "SEEG two" }),
      rated("4", -1, { h1: 41 }),
    ];
    // Each SEEG paper gets +TAP_STEP from the other one's tap: 40 + 0.05*40 = 42 > 41.
    const r = evaluate(xs, [{ term: "seeg", weight: 0.01, source: "taps" }]);
    expect(40 + TAP_STEP * POINTS_PER_WEIGHT).toBeGreaterThan(41);
    expect(r.methods.p1.order.slice(0, 3)).toEqual(["1", "3", "2"]);
  });

  it("reports the gate: not enough ratings below 50", () => {
    const r = evaluate([rated("1", 1)], []);
    expect(r.gate.status).toBe("too-few");
  });

  it("passes the gate only when p1@3 >= 0.6 and beats newest-first by a third", () => {
    // 50 ratings; p1 (via h1 here, no interests) puts three ups first,
    // newest-first puts three downs first.
    const xs: RatedPaper[] = [];
    for (let i = 0; i < 50; i++) {
      const up = i < 3;
      xs.push(rated(String(1000 + i), up ? 1 : -1, { h1: up ? 99 : 10, publishedMs: up ? 0 : 1000 + i }));
    }
    const r = evaluate(xs, []);
    expect(r.methods.p1.p3).toBe(1);
    expect(r.methods.newest.p3).toBe(0);
    expect(r.gate.status).toBe("pass");
    expect(GATE).toEqual({ minRatings: 50, minP3: 0.6, minLiftOverNewest: 1 / 3 });

    const flat = xs.map((x) => ({ ...x, h1: 10 }));
    expect(evaluate(flat, []).gate.status).toBe("fail");
  });
});

describe("formatReport", () => {
  it("prints n, the table, the gate and the known bias", () => {
    const out = formatReport(evaluate([rated("1", 1), rated("2", -1)], []));
    expect(out).toMatch(/ratings: 2 \(1 up, 1 down\)/);
    expect(out).toMatch(/p1/);
    expect(out).toMatch(/h1/);
    expect(out).toMatch(/newest-first/);
    expect(out).toMatch(/only rates what (he|you) (was|were) shown/i);
    expect(out).toMatch(/gate: not yet/);
  });
});
