# Sift — status

**What this is:** a phone widget that shows the newest *important* papers in your field.
The server turns PubMed's firehose into a short, ranked feed; the iPhone app and widget read it.

**Started:** 2026-09-21 (overnight agent session)

---

## Needs Kalp (human checkpoints)

| # | What | Why it needs you | Blocking what |
|---|---|---|---|
| **H1** | **Label `docs/eval/eval-set.csv`** — 53 real papers from your own three fields; put `y`/`n` in the `would_read` column. About 10 minutes. | This is the only thing that can tell us whether Sift is any good. 272 automated tests cannot. The bar is **precision@5 ≥ 0.6 and 2× a plain newest-first feed** — newest-first is exactly what a free PubMed alert gives you, so if Sift lands within one paper of it, it has no reason to exist and we stop. | Knowing whether to continue at all |
| **H2** | **Run the three zero-cost experiments** in `docs/market-research.md` §2.7 — especially the second: pick two papers a week yourself and email them to 15–20 people in your lab. | The research says the product is not viable but the *filter* might still be. An email list tests your judgement with no code, no App Store and no $99. | Whether there is a product here at all |
| **H3** | **Apple Developer Program, $99/yr** | No TestFlight, no install on your real iPhone, no App Group entitlement. Everything runs in the simulator on a local-file fallback. **Nothing has been bought.** | Sift on your actual Lock Screen |
| **H4** | **Review the 5 curated PubMed queries** in `scripts/seed-topics.mjs` | They are my guesses at what you want to read, and query tuning is worth more than ranking: field-tagging alone cut neuromodulation from 280 to 109 papers a week. | Feed quality |
| **H5** | **Decide the name** | "Sift" is taken by several products. Fine as a subdomain, a problem the day it goes on the App Store. Cheap now, expensive later. | App Store, if ever |

## Done

- Migration `0002_sift_core.sql` applied to Supabase Project B, schema `sift` (exposed to PostgREST).
- `lib/pubmed.ts` — typed E-utilities client, 3 req/s throttle, tolerant `pubdate` parser.
- `lib/ranking.ts` + `lib/journals.ts` — the ranker, weighted from measured distributions.
- `lib/feed.ts` — fetch/upsert/rank/serve with a 6-hour cache and stale-on-failure.
- `/api/feed`, `/api/topics`, `/api/refresh` (bearer, fails closed); `/api/health` unchanged.
- `/` and `/t/[slug]`, rendering live feeds.
- 5 topics seeded and verified against live PubMed.
- 216 tests, lint clean, build green, no network in tests.

## Known limits, stated honestly

- The ranker measures **evidence tier and form, not importance**. It cannot tell a surprising
  result from a routine one. `lib/ranking.ts` documents this at length.
- Title regexes match words, not meaning: a live run tagged a *chronic ankle instability*
  meta-analysis with "chronic, not acute". Reading abstracts (efetch) is the fix.
- Topic matching is PubMed's, not ours — that same ankle paper matched `neuromodulation` only
  via a tDCS MeSH term. A precision problem in the query, not in the ranker.

## Session log

| When | What happened |
|---|---|
| 2026-09-21 | Repo created from `KalpKan/portfolio-template`; 28/28 template tests green. |
| 2026-09-21 | Pivoted to Sift. Backend + web app built TDD: 28 -> 216 tests. Schema applied, topics seeded, live feed verified end to end. Not deployed (2-deploy budget held by Kalp). |
