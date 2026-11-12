import { describe, expect, it, vi } from "vitest";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("./track", () => ({ track }));

import { events } from "./events";

describe("events", () => {
  it("paper_opened from a public feed sends topic and rank", () => {
    events.paper_opened({ topic: "neuromodulation", rank: 2 });
    expect(track).toHaveBeenLastCalledWith("paper_opened", { topic: "neuromodulation", rank: 2 });
  });

  it("the private radar sends the PMID and the verdict only: never a title or an interest term", () => {
    events.radar_paper_opened({ pmid: "41234567" });
    expect(track).toHaveBeenLastCalledWith("paper_opened", { pmid: "41234567" });
    events.paper_rated({ pmid: "41234567", verdict: -1 });
    expect(track).toHaveBeenLastCalledWith("paper_rated", { pmid: "41234567", verdict: -1 });
  });

  it("drops any extra property a caller tries to slip in", () => {
    events.paper_rated({ pmid: "1", verdict: 1, title: "secret", term: "bci" } as never);
    expect(track).toHaveBeenLastCalledWith("paper_rated", { pmid: "1", verdict: 1 });
  });
});
