// Screenshot harness for the brain redesign (docs/superpowers/plans/2026-11-18-brain-redesign.md).
//
//   SIFT_DEV_PREVIEW=1 env -u NODE_OPTIONS npx next start -p 3107
//   env -u NODE_OPTIONS node scripts/ui-shots.mjs --base http://localhost:3107 --out docs/images/redesign/round-1
//
// For each page: 1440x900 and 390x844, light and dark (colorScheme emulation).
// /dev/radar is also shot with reduced motion (reducedMotion emulation).
// report.json lists, per shot: console errors, page errors, failed requests,
// cumulative layout shift, and whether the page scrolls sideways.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3107").replace(/\/$/, "");
const out = path.resolve(arg("out", "docs/images/redesign/shots"));

const PAGES = [
  { slug: "home", url: "/" },
  { slug: "topic-neuromodulation", url: "/t/neuromodulation" },
  { slug: "sign-in", url: "/sign-in" },
  { slug: "dev-radar", url: "/dev/radar", reduced: true },
  { slug: "dev-radar-empty", url: "/dev/radar?empty=1" },
  { slug: "dev-settings", url: "/dev/settings" },
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const SCHEMES = ["light", "dark"];
const SETTLE_MS = 1500;

// Runs before any page script: collects layout-shift entries into window.__cls.
const CLS_INIT = () => {
  window.__cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = [];

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const variants = [{ motion: "default", reducedMotion: "no-preference" }];
      if (page.reduced) variants.push({ motion: "reduced", reducedMotion: "reduce" });
      for (const v of variants) {
        const name = [page.slug, vp.name, scheme, ...(v.motion === "reduced" ? ["reduced"] : [])].join("-");
        const entry = { name, url: page.url, viewport: vp.name, scheme, motion: v.motion, status: null, consoleErrors: [], pageErrors: [], failedRequests: [], cls: null, overflowX: null };
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: scheme,
          reducedMotion: v.reducedMotion,
        });
        const p = await context.newPage();
        await p.addInitScript(CLS_INIT);
        p.on("console", (m) => {
          if (m.type() === "error") entry.consoleErrors.push(m.text());
        });
        p.on("pageerror", (e) => entry.pageErrors.push(String(e)));
        p.on("requestfailed", (r) => entry.failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ""}`.trim()));
        try {
          const res = await p.goto(base + page.url, { waitUntil: "load" });
          entry.status = res?.status() ?? null;
          await p.waitForTimeout(SETTLE_MS);
          entry.cls = Math.round((await p.evaluate(() => window.__cls)) * 10000) / 10000;
          entry.overflowX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
          await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
        } catch (e) {
          entry.pageErrors.push(`harness: ${String(e)}`);
        }
        await context.close();
        report.push(entry);
        console.log(`${name}: status ${entry.status} cls ${entry.cls} errors ${entry.consoleErrors.length + entry.pageErrors.length}`);
      }
    }
  }
}

await browser.close();
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
const bad = report.filter((r) => r.status !== 200 || r.consoleErrors.length || r.pageErrors.length || (r.cls ?? 1) >= 0.05 || r.overflowX);
console.log(`${report.length} shots, ${bad.length} with problems. Report: ${path.join(out, "report.json")}`);
