import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MeShell from "./MeShell";

describe("private pages are marked ph-no-capture at the root", () => {
  it("MeShell (every /me page, the private notice and the no-DB notice)", () => {
    const html = renderToStaticMarkup(
      <MeShell title="Settings" current="settings">
        <p>bci 0.40</p>
      </MeShell>,
    );
    expect(html).toMatch(/^<div class="ph-no-capture /);
  });

  it("/sign-in", async () => {
    const { default: SignInPage } = await import("@/app/sign-in/page");
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({}) } as never));
    expect(html).toMatch(/^<div class="ph-no-capture /);
  });
});
