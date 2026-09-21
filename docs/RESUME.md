# Sift — pick up here

*Last updated 2026-09-21, end of the overnight session. `docs/plan.md` is the full design;
this file is only "what is true right now and what to type next".*

## Read this first

The market research came back **against Sift being a product** (`docs/market-research.md`
§2.3–§2.6). The identical app already ships twice — AI Sentinel: Frontier has 0 ratings,
MediPub has 17 in three years — and the closest competitor shut down in November 2024 with,
by its own account, millions of users. Faculty rank this exact mechanism 12th of 14 ways they
keep up with their field.

That is not a reason to bin it. It is built, it works, and it is a strong portfolio piece.
It *is* a reason not to write much more code before **H1 and H2 in `STATUS.md`** are done.
The next useful thing is a labelled evaluation set and an email list, not another feature.

## What is true right now

- **Live:** https://sift.kalpkan.com — `/`, `/t/<slug>`, `/api/feed`, `/api/topics`,
  `/api/refresh`, `/api/health`. On the hub at https://kalpkan.com and on the status page.
- **Repo:** `KalpKan/sift` (public), local `/Users/kalp/projects/sift`
  (`~/projects/adwidget` is a symlink to it). `main` pushed and clean.
- **Database:** Supabase Project B (`platform`, ref `yzppfufqaekgaxcrsqxp`), schema `sift`:
  `topics`, `papers`, `topic_papers`, `refresh_runs`. RLS on all four with **no policies at
  all** — the anon key reads nothing; everything goes through the server's service-role key.
  5 topics seeded.
- **Tests:** `npm test` → 216 passing. `xcodebuild … test` → 56 passing.
- **Hosting:** Vercel project `sift` (`prj_7aFIqJgTgmbsaRRTLdfUIEfO4hfB`), 8 env vars set,
  UptimeRobot monitor `804044195`.
- **iOS:** builds and unit-tests headlessly. **Simulator only** — there is no Apple Developer
  Program membership, so no device, no TestFlight, no App Group (the store falls back to a
  local file, and there is a test for that).

## Exact next commands

```bash
cd /Users/kalp/projects/sift
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select points at CLT
set -a; source ~/.config/portfolio-ops/secrets.env; set +a

# sanity — all four should be green
npm test && npm run lint && npm run build && bash scripts/check-migrations.sh

# iOS
xcodebuild -project ios/Sift.xcodeproj -scheme Sift \
  -destination 'id=10A042A7-D499-4613-91D1-A52B6A9A3E10' \
  -derivedDataPath /tmp/siftdd test CODE_SIGNING_ALLOWED=NO
```

## The next three tasks, in order

**1. Finish the last wire (30 minutes).** `SiftAPI` is written and tested against a recorded
live response, but `FeedModel` in `ios/Sift/SiftApp.swift` still loads `Paper.samples` on
launch. Call `SiftAPI.fetchFeed(topic:)` in a `.task`, write the result with
`SharedStore.save(_:)`, then `WidgetCenter.shared.reloadTimelines(ofKind: SiftWidgetKind.papers)`,
and keep the samples as the failure path so the widget is never empty. Watch out for the
thing that already bit once: the server sends two different ISO 8601 shapes and
`SiftAPI.decoder()` handles both — do not "simplify" it back to `.iso8601`.

**2. H1 — label the eval set.** `docs/eval/eval-set.csv`, `y`/`n` in `would_read`, then score
the ranker against it per `docs/eval/README.md`. **This decides whether anything else is
worth doing.**

**3. H2 — the email-list experiment.** Two papers a week, chosen by you, emailed to 15–20
people in your lab. No code. See `docs/market-research.md` §2.7.

## Known issues, honestly

- **The ranker measures evidence tier, not importance.** A dull RCT re-testing a settled
  question beats a landmark first-in-human case series, every time.
- **Title cues match words, not meaning.** A live run put a *chronic ankle instability*
  meta-analysis second on the neuromodulation feed and tagged it "chronic, not acute" —
  matching the word "chronic". It only matched the topic at all through a tDCS MeSH term, so
  that one is a *query* failure upstream of the ranker. Both are documented in `lib/ranking.ts`.
- **Abstracts are not ours to show**, outside arXiv. NLM, Crossref and OpenAlex all disclaim
  the right to license them onward; arXiv's CC0 metadata explicitly permits it. We show
  titles only today, which is clean. The planned `efetch` step in P1 is a **legal** question.
- **OpenAlex became metered in dollars in 2026** — roughly 1,000 calls/day keyless. Our
  journal cache is well inside that, but it is no longer unlimited.
- **A widget can never prove it was seen.** No impression callback exists in WidgetKit. Any
  engagement number must come from taps.
- **Not done this session:** a reviewer and verifier pass. The session ended first.

## Two things that will cost you an hour if you forget them

1. `xcode-select -p` points at CommandLineTools, so `xcodebuild` looks broken. Export
   `DEVELOPER_DIR` instead of running `sudo xcode-select -s`.
2. `vercel project add` creates a project with **no framework preset**, and its first deploy
   fails with *"No Output Directory named public"*. `PATCH` the project to
   `framework: nextjs` first. Doing it in that order is also what let all eight env vars be
   set before the first deploy, so the whole app went live in a single one.
