// Screenshot harness for the brain redesign (docs/superpowers/plans/2026-11-18-brain-redesign.md).
//
//   SIFT_DEV_PREVIEW=1 env -u NODE_OPTIONS npx next start -p 3107
//   env -u NODE_OPTIONS node scripts/ui-shots.mjs --base http://localhost:3107 --out docs/images/redesign/round-2
//   (optional) --off-base http://localhost:3108   a server started WITHOUT SIFT_DEV_PREVIEW, to check the dev routes 404
//
// For each page: 1440x900 and 390x844, light and dark (colorScheme emulation).
// /dev/radar is also shot with reduced motion (reducedMotion emulation).
// report.json is { shots, summary, devGate }. `shots` lists, per shot: console errors, page
// errors, failed requests, cumulative layout shift, whether the page scrolls sideways, and
// `metrics` measured in the page (see MEASURE): per map the tract-to-label clearance, clipped
// parts, tap targets and soma radii; per page the rank-dot x, first title top, the sign-in hub
// against its button, the interest rows, and for /dev/radar the colour of an unpressed thumb.
// `summary` carries the measured contrasts (--wire, --control, the thumb glyph) and the
// tract-to-label clearance, and the tap test (390 px: tap each cell, its own row must light).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3107").replace(/\/$/, "");
const out = path.resolve(arg("out", "docs/images/redesign/shots"));
const offBase = arg("off-base", "").replace(/\/$/, "");

const PAGES = [
  { slug: "home", url: "/" },
  { slug: "topic-neuromodulation", url: "/t/neuromodulation" },
  { slug: "sign-in", url: "/sign-in" },
  { slug: "dev-radar", url: "/dev/radar", reduced: true },
  { slug: "dev-radar-empty", url: "/dev/radar?empty=1" },
  { slug: "dev-radar-fields1", url: "/dev/radar?fields=1" },
  { slug: "dev-radar-fields6", url: "/dev/radar?fields=6" },
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


// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};
const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

// Runs in the page. All lengths are SVG user units (the maps draw 1:1 at 1440 and 390).
const MEASURE = () => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const maps = [];
  document.querySelectorAll(".brain").forEach((root) => {
    const svg = root.querySelector("svg.brain-svg");
    const box = root.getBoundingClientRect();
    if (!svg || box.width === 0) return; // the hidden layout
    const vb = svg.viewBox.baseVal;
    const bb = (el) => {
      const b = el.getBBox();
      return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height, w: b.width };
    };
    const labels = [...svg.querySelectorAll(".brain-label")].map(bb);
    let clearance = Infinity;
    svg.querySelectorAll(".brain-tract").forEach((p) => {
      const len = p.getTotalLength();
      const n = Math.max(40, Math.ceil(len / 3));
      for (let i = 0; i <= n; i++) {
        const pt = p.getPointAtLength((len * i) / n);
        for (const b of labels) {
          const dx = Math.max(b.x0 - pt.x, 0, pt.x - b.x1);
          const dy = Math.max(b.y0 - pt.y, 0, pt.y - b.y1);
          clearance = Math.min(clearance, Math.hypot(dx, dy));
        }
      }
    });
    const clipped = [];
    const inside = (b) => b.x0 >= -0.5 && b.y0 >= -0.5 && b.x1 <= vb.width + 0.5 && b.y1 <= vb.height + 0.5;
    svg.querySelectorAll(".brain-den, .brain-soma, .brain-ring-new").forEach((el) => {
      if (!inside(bb(el))) clipped.push(el.getAttribute("class") + " of " + (el.closest("[data-cell]")?.dataset.cell ?? "?"));
    });
    svg.querySelectorAll(".brain-label").forEach((el) => {
      if (!inside(bb(el))) clipped.push("label " + el.textContent);
    });
    const hits = [...svg.querySelectorAll(".brain-hit")].map((c) => ({
      pmid: c.closest("[data-pmid]").dataset.pmid,
      x: +c.getAttribute("cx"),
      y: +c.getAttribute("cy"),
      r: +c.getAttribute("r"),
    }));
    let overlaps = 0;
    for (let i = 0; i < hits.length; i++)
      for (let j = i + 1; j < hits.length; j++)
        if (Math.hypot(hits[i].x - hits[j].x, hits[i].y - hits[j].y) < hits[i].r + hits[j].r - 0.01) overlaps++;
    const somas = [...svg.querySelectorAll("[data-pmid]")]
      .map((g) => ({ pmid: g.dataset.pmid, r: r2(+g.querySelector(".brain-halo-1").getAttribute("r") / 1.8) }))
      .sort((a, b) => (a.pmid < b.pmid ? -1 : 1));
    // Two somas overlap when their centres are closer than the sum of their radii.
    const cells = [...svg.querySelectorAll(".brain-neuron")].map((g) => {
      const soma = g.querySelector(".brain-halo-1");
      return soma ? { x: +soma.getAttribute("cx"), y: +soma.getAttribute("cy"), r: +soma.getAttribute("r") / 1.8 } : null;
    }).filter(Boolean);
    let somaOverlaps = 0;
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++)
        if (Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y) < cells[i].r + cells[j].r) somaOverlaps++;
    const labelWeights = [...new Set([...svg.querySelectorAll(".brain-label")].map((el) => getComputedStyle(el).fontWeight))];
    maps.push({
      variant: [...root.classList].find((c) => /^brain-(radar|hero|topic|motif)$/.test(c)).slice(6),
      layout: root.dataset.layout,
      viewBox: `${vb.width}x${vb.height}`,
      boxHeight: r2(box.height),
      tractLabelClearance: clearance === Infinity ? null : r2(clearance),
      tracts: svg.querySelectorAll(".brain-tract").length,
      clipped,
      hitRadius: hits.length ? { min: Math.min(...hits.map((h) => h.r)), max: Math.max(...hits.map((h) => h.r)), overlaps, count: hits.length } : null,
      somaOverlaps,
      somaRadii: somas.length ? somas : null,
      labelWeights,
    });
  });

  const rect = (el) => el?.getBoundingClientRect();
  const articles = [...document.querySelectorAll("article")];
  const dots = articles.map((a) => rect(a.querySelector("span.rounded-full"))?.left).filter((v) => v !== undefined);
  const title = document.querySelector("article h3");
  const page = {
    dotLeft: dots.length ? { count: dots.length, min: r2(Math.min(...dots)), max: r2(Math.max(...dots)), spread: r2(Math.max(...dots) - Math.min(...dots)) } : null,
    firstTitleTop: title ? r2(rect(title).top + scrollY) : null,
    oneWeeksOld: articles.filter((a) => /\b1 (weeks|days|months) old/.test(a.textContent)).length,
    oneWeekOld: articles.filter((a) => /\b1 (week|day|month) old/.test(a.textContent)).length,
    splitTopicNames: articles.filter((a) => [...a.querySelectorAll("p span.font-medium")].some((s) => s.getClientRects().length > 1)).length,
    footnote: [...document.querySelectorAll("p")].some((p) => p.textContent.includes("teach the ranking")),
    figure: (() => {
      const f = document.querySelector("figure");
      if (!f) return null;
      const m = document.querySelector("main").getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      return { left: r2(fr.left), right: r2(fr.right), mainContentLeft: r2(m.left + parseFloat(getComputedStyle(document.querySelector("main")).paddingLeft)), caption: f.querySelector("figcaption")?.textContent ?? null };
    })(),
  };

  const btn = document.querySelector("main button");
  const svg = document.querySelector("main .brain-motif svg");
  if (btn && svg) {
    const b = rect(btn);
    const s = rect(svg);
    const h1 = rect(document.querySelector("h1"));
    const block = rect(btn.parentElement);
    page.signIn = {
      hubX: r2(s.left + s.width / 2),
      buttonCentreX: r2(b.left + b.width / 2),
      hubY: r2(s.bottom),
      buttonTop: r2(b.top),
      blockLeft: r2(block.left),
      headingLeft: r2(h1.left),
    };
  }

  const interests = [...document.querySelectorAll("ul.divide-y li")].filter((li) => li.querySelector("span.tabular"));
  if (interests.length) {
    page.interests = interests.map((li) => {
      const action = li.lastElementChild;
      const weight = li.querySelector("span.tabular");
      const lh = (el) => parseFloat(getComputedStyle(el).lineHeight);
      return {
        text: li.textContent,
        height: r2(rect(li).height),
        actionLines: Math.round(rect(action).height / lh(action)),
        weightLeft: r2(rect(weight).left),
        weightTop: r2(rect(weight).top - rect(li).top),
      };
    });
  }
  return { maps, page };
};

// Median colour of the glyph pixels of the first unpressed thumb, and its contrast against the paper.
async function thumbGlyph(page, paperHex) {
  const handle = await page.$('button[aria-label="Useful to me"][aria-pressed="false"]');
  if (!handle) return null;
  const box = await handle.boundingBox();
  const png = await page.screenshot({ clip: { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 } });
  const median = await page.evaluate(async ({ b64, bg }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const chans = [[], [], []];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      if (Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) <= 12) continue; // background
      for (let k = 0; k < 3; k++) chans[k].push(d[i + k]);
    }
    const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    return chans[0].length ? [med(chans[0]), med(chans[1]), med(chans[2])] : null;
  }, { b64: png.toString("base64"), bg: hex(paperHex) });
  return median ? { median: toHex(median), pixels: true, contrastOnPaper: contrast(median, hex(paperHex)) } : null;
}

// 390 px: tap each cell's centre; its own row must be lit and scrolled into view.
async function tapTest(page) {
  const cells = await page.evaluate(() => {
    const root = [...document.querySelectorAll(".brain-radar")].find((r) => r.getBoundingClientRect().width > 0);
    return [...root.querySelectorAll(".brain-hit")].map((c) => ({ pmid: c.closest("[data-pmid]").dataset.pmid, x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
  });
  const results = [];
  for (const cell of cells) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const at = await page.evaluate(() => {
      const root = [...document.querySelectorAll(".brain-radar")].find((r) => r.getBoundingClientRect().width > 0);
      const s = root.querySelector("svg").getBoundingClientRect();
      return { left: s.left, top: s.top, scale: s.width / root.querySelector("svg").viewBox.baseVal.width };
    });
    await page.mouse.click(at.left + cell.x * at.scale, at.top + cell.y * at.scale);
    await page.waitForTimeout(1000);
    const row = await page.evaluate((pmid) => {
      const el = document.getElementById(`paper-${pmid}`);
      const r = el.getBoundingClientRect();
      return { inView: r.top >= 0 && r.bottom <= innerHeight, centreOffset: Math.round(r.top + r.height / 2 - innerHeight / 2), lit: el.className.includes("bg-surface") };
    }, cell.pmid);
    results.push({ pmid: cell.pmid, ...row, ok: row.inView && row.lit });
  }
  return { correct: results.filter((r) => r.ok).length, of: results.length, results };
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = [];
const contrasts = {};
const summary = { contrast: contrasts, tractLabelClearance: { min: null, byShot: {} }, thumbGlyph: {}, tapTest: null };

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const variants = [{ motion: "default", reducedMotion: "no-preference" }];
      if (page.reduced) variants.push({ motion: "reduced", reducedMotion: "reduce" });
      for (const v of variants) {
        const name = [page.slug, vp.name, scheme, ...(v.motion === "reduced" ? ["reduced"] : [])].join("-");
        const entry = { name, url: page.url, viewport: vp.name, scheme, motion: v.motion, status: null, consoleErrors: [], pageErrors: [], failedRequests: [], cls: null, overflowX: null, metrics: null };
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
          entry.metrics = await p.evaluate(MEASURE);
          const vars = await p.evaluate(() => Object.fromEntries(["--paper", "--wire", "--control", "--ink-muted", "--ink-faint", "--rule-strong"].map((k) => [k, getComputedStyle(document.documentElement).getPropertyValue(k).trim()])));
          if (!contrasts[scheme]) {
            const paper = hex(vars["--paper"]);
            contrasts[scheme] = {
              paper: vars["--paper"],
              wire: { value: vars["--wire"], onPaper: contrast(hex(vars["--wire"]), paper) },
              control: { value: vars["--control"], onPaper: contrast(hex(vars["--control"]), paper) },
              inkMuted: vars["--ink-muted"],
            };
          }
          const clear = entry.metrics.maps.map((m) => m.tractLabelClearance).filter((v) => v !== null);
          if (clear.length) {
            summary.tractLabelClearance.byShot[name] = Math.min(...clear);
            const m = Math.min(...clear);
            if (summary.tractLabelClearance.min === null || m < summary.tractLabelClearance.min) summary.tractLabelClearance.min = m;
          }
          if (page.slug === "dev-radar" && v.motion === "default") {
            entry.metrics.thumbGlyph = await thumbGlyph(p, vars["--paper"]);
            summary.thumbGlyph[`${vp.name}-${scheme}`] = entry.metrics.thumbGlyph;
          }
          await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
          if (page.slug === "dev-radar" && v.motion === "default" && vp.name === "mobile" && scheme === "light") summary.tapTest = await tapTest(p);
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

// The dev routes must 404 when SIFT_DEV_PREVIEW is unset.
const devGate = {};
if (offBase) {
  for (const url of ["/dev/radar", "/dev/radar?fields=1", "/dev/radar?fields=6", "/dev/settings"]) {
    devGate[url] = (await fetch(offBase + url)).status;
  }
}
await writeFile(path.join(out, "report.json"), JSON.stringify({ shots: report, summary, devGate }, null, 2) + "\n");
const bad = report.filter((r) => r.status !== 200 || r.consoleErrors.length || r.pageErrors.length || (r.cls ?? 1) >= 0.05 || r.overflowX);
console.log(`${report.length} shots, ${bad.length} with problems. Report: ${path.join(out, "report.json")}`);
const clipped = report.filter((r) => r.metrics?.maps.some((m) => m.clipped.length));
console.log(`clipped parts in ${clipped.length} shots; min tract-to-label clearance ${summary.tractLabelClearance.min}; contrast ${JSON.stringify(contrasts)}`);
if (summary.tapTest) console.log(`tap test: ${summary.tapTest.correct} of ${summary.tapTest.of}`);
