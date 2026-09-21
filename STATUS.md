# Sift — status

**What this is:** a phone widget that shows the newest *important* papers in your field.
The server turns PubMed's firehose into a short, ranked feed; the iPhone app and widget read it.

**Started:** 2026-09-21 (overnight agent session)

---

## Needs Kalp (human checkpoints)

| # | What | Why it needs you | Blocking? |
|---|---|---|---|
| H1 | Label `docs/eval/eval-set.csv` — put `y`/`n` in `would_read` for 53 rows, ~10 min | Nothing in the test suite can tell us whether the top 3 are the 3 you'd have wanted. This is the only way to find out, and it is the project's real quality gate. See `docs/eval/README.md`. | Not blocking, but the ranker is unvalidated until it is done |
| H2 | Set `SUPABASE_SERVICE_ROLE_KEY` and `SIFT_REFRESH_TOKEN` in Vercel before the first deploy | Server-only secrets; they are in `.env.local` locally but Vercel has never seen them. Without them the deployed site renders but has no data. | Blocks a working deploy |
| H3 | Review the curated queries in `scripts/seed-topics.mjs` | They are hand-tuned guesses at what you actually want to read. You are the only person who knows if `neural-engineering` should include optogenetics. | No |

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
