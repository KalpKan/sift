# Sift — status

**What this is:** an iPhone app and widget that shows you the newest *important* papers in
your field. It started the same night as a different idea (a widget that shows ads and pays
you); that one turned out to be banned outright by both app stores, and `docs/why-not-ads.md`
records why so nobody proposes it again.

**Started:** 2026-09-21.

**Night protocol acknowledged 2026-09-21 02:20.**

## Definition of done for this session

| # | Item | How it is verified | State |
|---|---|---|---|
| 1 | Why the ad idea is dead, cited | `docs/why-not-ads.md` | DONE |
| 1b | Sift's own market/competitive verdict, cited | `docs/market-research.md` | pending |
| 2 | Spec and plan for the MVP | `docs/spec.md`, `docs/plan.md` | plan DONE, spec pending |
| 3 | `sift` schema applied, RLS on, tested | SQL against Project B + `lib/schema.test.ts` | DONE (4 tables, RLS on, 0 policies) |
| 4 | PubMed client + ranking, fixture-tested, proven on >= 2 fields | `npm test` | client DONE; ranking pending |
| 5 | iOS app + widget build and test headlessly | `xcodebuild ... test` | DONE - 49 tests, 0 failures, appex embedded |
| 5b | Widget shows a real feed from the API | simulator + `/api/feed` | pending |
| 6 | Web/API deployed, health + monitor | `curl https://sift.kalpkan.com/api/health` | pending (0 of 2 deploys used) |
| 7 | STATUS.md accurate, RESUME.md written | this file, `docs/RESUME.md` | DONE |
| 8 | Reviewer + verifier passed | their reports | pending |


---

## Needs Kalp

| # | What | Why it needs you | Blocking what |
|---|---|---|---|
| H1 | **Apple Developer Program, $99/yr** | Without it there is no TestFlight, no installing on your actual iPhone, and no App Group entitlement — which is the shared container the app uses to hand papers to the widget. Everything currently runs in the simulator with a local-file fallback. **I have not bought anything.** | Sift on your real lock screen |
| H2 | **Hand-label an evaluation set** | The ranker sorts papers by PubMed publication type. Whether that is actually *good* is a judgement only you can make. Take 50 recent papers in one of your fields, mark each "would read" / "wouldn't", and we can score the ranker against it. Until this exists, nobody knows if Sift is useful or just tidy. | Knowing whether this is worth continuing |
| H3 | **Confirm the topics are the right ones** | I seeded topics from your stated interests (neuromodulation, brain–computer interfaces, spinocerebellar ataxia, deep brain stimulation, neural engineering). The PubMed query behind each is hand-tuned and can be sharpened. | Feed quality |
| H4 | **Decide whether this is a portfolio piece or a product** | They pull in different directions. A portfolio piece optimises for a good case study. A product needs users who are not you. | Roadmap after P0 |

## What works right now

*(filled in as each piece lands)*

## Known weaknesses — read these before getting excited

1. **The ranker measures evidence tier, not importance.** PubMed publication types separate a
   meta-analysis from a case report very well, and a landmark result from a routine one not at
   all. A small RCT re-testing a settled question will outrank a first-in-human case series.
2. **The competition is an email you already ignore.** PubMed My NCBI alerts and Google Scholar
   alerts are free, already installed, and do the fetching part fine. Sift is only worth
   anything if the *filtering* is visibly better. That is the whole bet.
3. **A widget cannot prove it was seen.** There is no impression or visibility callback in
   WidgetKit. Any engagement number will come from taps only, and we should never pretend
   otherwise.

## Session log

| When | What happened |
|---|---|
| 2026-09-21 | Started as AdSpace (ad widget). Killed on evidence: Apple guideline 2.5.18, Google Play's "widgetized ad units" clause, AdMob's pay-to-view ban. Pivoted to Sift. |
