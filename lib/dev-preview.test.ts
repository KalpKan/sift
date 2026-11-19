import { describe, expect, it } from "vitest";
import { isDevPreviewEnabled } from "./dev-preview";

describe("isDevPreviewEnabled", () => {
  it("is off by default", () => {
    expect(isDevPreviewEnabled({})).toBe(false);
  });
  it("is on with SIFT_DEV_PREVIEW=1", () => {
    expect(isDevPreviewEnabled({ SIFT_DEV_PREVIEW: "1" })).toBe(true);
  });
  it("is never on under Vercel", () => {
    expect(isDevPreviewEnabled({ SIFT_DEV_PREVIEW: "1", VERCEL: "1" })).toBe(false);
  });
  it("needs exactly 1", () => {
    expect(isDevPreviewEnabled({ SIFT_DEV_PREVIEW: "true" })).toBe(false);
  });
});
