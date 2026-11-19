import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RadarView from "./RadarView";
import { DEV_NOW, DEV_RADAR_FEED, devRadarVariant } from "@/lib/dev-fixtures";

describe("RadarView footnote", () => {
  it("shows the thumbs footnote when there are rows to rate", () => {
    const v = devRadarVariant(undefined);
    const html = renderToStaticMarkup(<RadarView fields={v.fields} papers={DEV_RADAR_FEED.papers} now={DEV_NOW} />);
    expect(html).toContain("teach the ranking");
  });
  it("hides it when there are no rows", () => {
    const v = devRadarVariant(undefined);
    const html = renderToStaticMarkup(<RadarView fields={v.fields} papers={[]} now={DEV_NOW} />);
    expect(html).not.toContain("teach the ranking");
  });
});

describe("dev radar variants", () => {
  it("fields=1 puts all ten papers in one field", () => {
    const v = devRadarVariant("1");
    expect(v.fields).toHaveLength(1);
    expect(v.papers).toHaveLength(10);
    expect(new Set(v.papers.map((p) => p.topic))).toEqual(new Set([v.fields[0].slug]));
  });
  it("fields=6 follows six fields, spreads ten papers, and leaves at least one field empty", () => {
    const v = devRadarVariant("6");
    expect(v.fields).toHaveLength(6);
    expect(v.papers).toHaveLength(10);
    const used = new Set(v.papers.map((p) => p.topic));
    expect(v.fields.every((f) => used.has(f.slug))).toBe(false);
    expect([...used].every((t) => v.fields.some((f) => f.slug === t))).toBe(true);
  });
  it("anything else is the default four fields", () => {
    expect(devRadarVariant("9").fields).toHaveLength(4);
    expect(devRadarVariant(undefined).fields).toHaveLength(4);
  });
});
