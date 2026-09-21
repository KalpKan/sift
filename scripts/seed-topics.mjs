#!/usr/bin/env node
/**
 * Seeds `sift.topics` with Kalp's curated topics.
 *
 * Run it with the service-role key in the environment:
 *     node --env-file=.env.local scripts/seed-topics.mjs
 * Add --dry-run to print the queries and their live 7-day PubMed counts
 * without writing anything.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE QUERIES ARE HAND-WRITTEN
 * ---------------------------------------------------------------------------
 * This is the single highest-leverage file in the repo, and it is 100 lines of
 * text with no code in it.
 *
 * PubMed applies "automatic term mapping" to a bare word: it silently expands
 * it into every MeSH heading, pharmacological action and synonym it can find.
 * For `neuromodulation` that expansion includes
 * `"neurotransmitter agents"[Pharmacological Action]`, which is why the naive
 * query returns 280 papers in seven days — most of them pharmacology papers
 * that mention a neurotransmitter and have nothing to do with stimulating the
 * nervous system. Writing the query out by hand with field tags and MeSH
 * headings cuts that to 109 in the same window: a 2.6x improvement, for free,
 * before the ranker has done anything at all.
 *
 * Measured 7-day counts on 2026-09-21, naive -> the exact queries below:
 *     neuromodulation             280 -> 109    (2.6x)
 *     brain-computer interface     31 ->  26
 *     deep brain stimulation       37 ->  29
 *     spinocerebellar ataxia        4 ->   5
 *     neural engineering             —->  16
 * Field-tagging pays off enormously for broad words and barely at all for
 * specific ones, which is exactly what you would expect and worth knowing
 * before writing the next query.
 *
 * This is also why topics are curated rather than a free-text box in the app.
 * One person tuning five queries beats ten thousand people typing one each,
 * and the difference is the whole product.
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * `kind` drives the ranker (lib/ranking.ts). 'clinical' literatures are densely
 * tagged with MeSH publication types, so publication type is trusted heavily.
 * 'engineering' literatures are barely tagged at all — 60% of BCI papers carry
 * no usable type — so the ranker leans on journal, human-subject and scale
 * cues instead. Labelling a topic wrongly will quietly make its feed worse.
 */
const TOPICS = [
  {
    slug: "neuromodulation",
    name: "Neuromodulation",
    kind: "clinical",
    description: "Stimulating the nervous system on purpose: TMS, tDCS, VNS, SCS and DBS.",
    // The NOT clause is the whole point. Without it PubMed's automatic term
    // mapping folds in "neurotransmitter agents"[Pharmacological Action] and
    // the feed fills with pharmacology. 280 papers/week becomes 109.
    pubmed_query: [
      '("neuromodulation"[Title/Abstract] OR "neurostimulation"[Title/Abstract]',
      'OR "Transcranial Magnetic Stimulation"[MeSH Terms]',
      'OR "Transcranial Direct Current Stimulation"[MeSH Terms]',
      'OR "Vagus Nerve Stimulation"[MeSH Terms]',
      'OR "Spinal Cord Stimulation"[MeSH Terms]',
      'OR "Deep Brain Stimulation"[MeSH Terms]',
      'OR "Implantable Neurostimulators"[MeSH Terms])',
      'NOT "Neurotransmitter Agents"[Pharmacological Action]',
    ].join(" "),
  },
  {
    slug: "brain-computer-interfaces",
    name: "Brain-computer interfaces",
    kind: "engineering",
    description: "Reading intention out of the brain and giving it somewhere to go.",
    // "brain computer interface" unquoted matches any paper containing all
    // three words. The quoted phrase plus the MeSH heading is much tighter,
    // and the truncated "neuroprosthe*" catches the noun and the adjective.
    pubmed_query: [
      '("Brain-Computer Interfaces"[MeSH Terms]',
      'OR "brain-computer interface"[Title/Abstract] OR "brain computer interface"[Title/Abstract]',
      'OR "brain-machine interface"[Title/Abstract]',
      'OR "neuroprosthe*"[Title/Abstract]',
      'OR "intracortical"[Title/Abstract])',
    ].join(" "),
  },
  {
    slug: "deep-brain-stimulation",
    name: "Deep brain stimulation",
    kind: "clinical",
    description: "Electrodes in deep nuclei for Parkinson's, tremor, dystonia and beyond.",
    // The parenthesised AND is explicit: PubMed evaluates left to right and
    // would otherwise attach the AND to only the last OR branch.
    pubmed_query: [
      '("Deep Brain Stimulation"[MeSH Terms]',
      'OR "deep brain stimulation"[Title/Abstract]',
      'OR ("subthalamic nucleus"[Title/Abstract] AND "stimulation"[Title/Abstract])',
      'OR ("globus pallidus"[Title/Abstract] AND "stimulation"[Title/Abstract]))',
    ].join(" "),
  },
  {
    slug: "spinocerebellar-ataxia",
    name: "Spinocerebellar ataxia",
    kind: "clinical",
    description: "The inherited cerebellar degenerations, including Machado-Joseph disease.",
    // DELIBERATELY NO bare `SCA[tiab]`. Measured: adding it doubles the 7-day
    // count from 4 to 8 by dragging in sickle cell anemia, subclavian artery
    // and sudden cardiac arrest. On a feed this small that is half the feed.
    pubmed_query: [
      '("Spinocerebellar Ataxias"[MeSH Terms]',
      'OR "Spinocerebellar Degenerations"[MeSH Terms]',
      'OR "Machado-Joseph Disease"[MeSH Terms]',
      'OR "spinocerebellar ataxia"[Title/Abstract]',
      'OR "ataxin"[Title/Abstract])',
    ].join(" "),
  },
  {
    slug: "neural-engineering",
    name: "Neural engineering",
    kind: "engineering",
    description: "Electrodes, arrays and the hardware that makes neural interfaces possible.",
    pubmed_query: [
      '("neural engineering"[Title/Abstract]',
      'OR "neural interface*"[Title/Abstract]',
      'OR "microelectrode array*"[Title/Abstract]',
      'OR "Electrocorticography"[MeSH Terms]',
      'OR "Optogenetics"[MeSH Terms]',
      'OR "Neural Prostheses"[MeSH Terms])',
    ].join(" "),
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Live sanity check: does the query parse, and how much does it return? */
async function count(query) {
  const p = new URLSearchParams({
    db: "pubmed",
    term: query,
    rettype: "count",
    retmode: "json",
    datetype: "edat",
    reldate: "7",
    tool: "sift-kalpkan",
  });
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${p}`);
  const json = await res.json();
  await sleep(400); // NCBI allows 3 req/s without a key. Do not parallelise.
  const errors = json.esearchresult?.errorlist;
  const bad = [...(errors?.phrasesnotfound ?? []), ...(errors?.fieldsnotfound ?? [])];
  return { count: Number(json.esearchresult?.count ?? -1), warnings: bad };
}

async function main() {
  console.log(`Checking ${TOPICS.length} curated queries against PubMed (7-day window)...\n`);
  let bad = 0;
  for (const t of TOPICS) {
    const { count: n, warnings } = await count(t.pubmed_query);
    const flag = n < 0 ? "FAILED" : `${n} papers/week`;
    console.log(`  ${t.slug.padEnd(26)} ${String(flag).padStart(16)}  [${t.kind}]`);
    if (warnings.length) console.log(`      warning: PubMed did not recognise ${warnings.join(", ")}`);
    if (n < 0) bad++;
  }
  if (bad) {
    console.error(`\n${bad} query/queries failed to run. Not seeding.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.NEXT_PUBLIC_APP_SCHEMA;
  if (!url || !key || !schema) {
    console.error(
      "\nMissing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_APP_SCHEMA.\n" +
        "Run with: node --env-file=.env.local scripts/seed-topics.mjs",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upsert on `slug`, so re-running after editing a query updates it in place
  // rather than creating a duplicate topic with the same name.
  const { data, error } = await supabase
    .from("topics")
    .upsert(TOPICS, { onConflict: "slug" })
    .select("slug, name, kind");
  if (error) {
    console.error("\nseed failed:", error.message);
    process.exit(1);
  }
  console.log(`\nSeeded ${data.length} topics into ${schema}.topics:`);
  for (const t of data) console.log(`  ${t.slug} — ${t.name} [${t.kind}]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
