# Sift — status

**What this is:** a phone widget that shows the newest *important* papers in your field.
The server turns PubMed's firehose into a short, ranked feed; the iPhone app and widget read it.

**Started:** 2026-09-21 (overnight agent session)

---

## Needs Kalp (human checkpoints)

*Revised 2026-11-12, when Sift became Kalp's research radar (`docs/spec.md`, last section).*

| # | What | Why it needs you | Blocking what |
|---|---|---|---|
| **H1** | **Tap 👍/👎 on about 50 papers** over the first two weeks of using `/me` (and the app). Replaces labelling `eval-set.csv`. | The taps are the only evidence of whether the ranking beats newest-first. Gate: precision@3 ≥ 0.6 and one paper in three better than newest-first. | Knowing whether ranking or UI comes next |
| ~~H2~~ | ~~Email-list experiment~~ — **dropped 2026-11-12**; Sift is his own radar first. | | |
| **H3** | **Buy the Apple Developer Program ($99/yr), then tell an agent.** Kalp said 2026-11-12 he will. | Team ID, App Group, install on your iPhone. | Sift on your real lock screen |
| ~~H4~~ | ~~Review the queries~~ — **answered 2026-11-12**: follow BCI, neural engineering, DBS, stem cells (new). | | |
| **H5** | **Decide the name.** "Sift" is taken by several products. | Cheap now, expensive after the App Store. | App Store, if ever |
| **H6** | **Possibly one dashboard click** to allow `https://sift.kalpkan.com/auth/callback` (and `sift://auth-callback`) as Supabase Auth redirects, if the Management API cannot set it. | Google sign-in needs it. | `/me` and app sign-in |

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
| 2026-11-12 | Re-scoped as Kalp's research radar (web + iOS, 👍/👎 learning, Obsidian `[[research]]` interests). Docs updated: `spec.md` scope revision, `plan.md` §7.1 + §8, new `obsidian-bridge.md`. |
