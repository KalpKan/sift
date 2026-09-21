#!/usr/bin/env node
/**
 * Records real NCBI E-utilities responses into tests/fixtures/pubmed/ so the
 * unit tests can parse genuine PubMed JSON without ever touching the network.
 *
 * Run it by hand (`node scripts/capture-fixtures.mjs`) when you want to refresh
 * the fixtures; it is NOT part of `npm test`, which must stay offline.
 *
 * NCBI allows 3 requests/second without an API key, so every call here is
 * serialised and spaced by SPACING_MS. Do not parallelise this.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "pubmed");
const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const SPACING_MS = 400; // < 3 req/s, with margin
const TOOL = "sift-kalpkan"; // NCBI asks callers to identify themselves

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": `${TOOL}/0.1 (https://kalpkan.com)` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const json = await res.json();
  await sleep(SPACING_MS);
  return json;
}

function esearchUrl(term, { days = 3650, retmax = 10 } = {}) {
  const p = new URLSearchParams({
    db: "pubmed",
    term,
    sort: "date",
    retmax: String(retmax),
    retmode: "json",
    datetype: "edat",
    reldate: String(days),
    tool: TOOL,
  });
  return `${BASE}/esearch.fcgi?${p}`;
}

function esummaryUrl(pmids) {
  const p = new URLSearchParams({ db: "pubmed", id: pmids.join(","), retmode: "json", tool: TOOL });
  return `${BASE}/esummary.fcgi?${p}`;
}

function save(name, json) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, name), JSON.stringify(json, null, 2) + "\n");
  console.log("wrote", name);
}

/** Queries chosen so the ranking corpus really contains every publication type. */
const CORPUS_QUERIES = [
  ["meta", 'neuromodulation AND "meta analysis"[pt]', 5],
  ["systematic", '"deep brain stimulation"[MeSH Terms] AND systematic[sb]', 5],
  ["rct", '"deep brain stimulation"[MeSH Terms] AND "randomized controlled trial"[pt]', 5],
  ["guideline", "neurostimulation AND (guideline[pt] OR practice guideline[pt])", 3],
  ["case", '"deep brain stimulation"[MeSH Terms] AND "case reports"[pt]', 6],
  ["editorial", "neuromodulation AND (editorial[pt] OR comment[pt] OR letter[pt])", 6],
  ["review", '"brain computer interfaces"[MeSH Terms] AND review[pt]', 4],
  ["plain", '"spinocerebellar ataxias"[MeSH Terms]', 6],
];

async function main() {
  // 1. The exact live query the task verified: recent neuromodulation papers.
  const recent = await get(esearchUrl("neuromodulation", { days: 7, retmax: 20 }));
  save("esearch-neuromodulation-7d.json", recent);

  // 2. A query that legitimately matches nothing, so the client's empty path is real.
  const empty = await get(esearchUrl("zzqqxx_not_a_real_pubmed_term_9182", { days: 7, retmax: 10 }));
  save("esearch-empty.json", empty);

  // 3. Summaries for a couple of the recent hits: the small, everyday response.
  const smallIds = (recent.esearchresult?.idlist ?? []).slice(0, 3);
  if (smallIds.length) save("esummary-small.json", await get(esummaryUrl(smallIds)));

  // 4. A ranking corpus deliberately spanning every publication type.
  const ids = new Set();
  for (const [label, term, retmax] of CORPUS_QUERIES) {
    const r = await get(esearchUrl(term, { days: 3650, retmax }));
    const got = r.esearchresult?.idlist ?? [];
    console.log(`  ${label}: ${got.length} pmids`);
    for (const id of got) ids.add(id);
  }
  const corpus = [...ids];
  save("esummary-corpus.json", await get(esummaryUrl(corpus)));
  console.log(`corpus size: ${corpus.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
