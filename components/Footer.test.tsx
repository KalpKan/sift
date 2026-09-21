import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Footer from "./Footer";

describe("Footer", () => {
  it("says the app is part of kalpkan.com and links to the hub", () => {
    const html = renderToStaticMarkup(<Footer service="myapp" />);
    expect(html).toContain("part of kalpkan.com");
    expect(html).toMatch(/<a[^>]*href="https:\/\/kalpkan\.com"/);
    expect(html).toContain("myapp");
  });

  it("links to the app's own health route so a visitor can see it is up", () => {
    const html = renderToStaticMarkup(<Footer service="myapp" />);
    expect(html).toMatch(/href="\/api\/health"/);
  });
});
