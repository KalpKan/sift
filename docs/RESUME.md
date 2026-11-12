# Sift — pick up here

*Last updated 2026-11-12 (evening, after Phases 2 and 3). `docs/spec.md` (last section) says what v2 is, `docs/plan.md` §8
how it fits, `docs/obsidian-bridge.md` the privacy rules. This file is only "what is true right
now and what to do next". The build plan approved by Kalp is
`~/.claude/plans/i-need-a-place-fluttering-eagle.md`.*

## What Sift is now

Kalp's own research radar: a private feed of the week's important papers in brain-computer
interfaces, neural engineering, deep brain stimulation and stem cells, on the web (`/me`) and
on his iPhone (app + widget), ranked for him and learning from his 👍/👎 taps and from his
`[[research]]`-tagged Obsidian notes. Public pages stay as the generic case study.

## What is true right now (2026-11-12, after Phases 2 and 3)

- **Live:** https://sift.kalpkan.com — public `/`, `/t/<slug>`, `/api/feed`, `/api/topics`,
  `/api/refresh` (POST per topic with `SIFT_REFRESH_TOKEN`; GET = daily cron with `CRON_SECRET`),
  `/api/health`; private `/me`, `/me/settings`, `/sign-in`, `/auth/callback`, `/auth/sign-out`,
  `/api/me/{feed,rate,open,interests,follows}`. Health green, UptimeRobot `804044195`.
- **Deploys:** the Vercel project is connected to `KalpKan/sift` since 2026-11-12, so a push to
  `main` deploys (the `ignoreCommand` in `vercel.json` skips docs/scripts/iOS-only pushes).
- **Database:** Supabase Project B (`yzppfufqaekgaxcrsqxp`), schema `sift`. Public tables
  `topics`, `papers`, `topic_papers`, `refresh_runs` (RLS, no policies). Private radar tables
  `profiles`, `follows`, `ratings`, `opens`, `interests` (0003; owner-only RLS on `auth.uid()`).
  **No owner row exists yet**: it is created on Kalp's first sign-in.
- **Sign-in is blocked on STATUS.md H6:** Project B's Google provider is off and needs Kalp's
  Google OAuth client ID + secret. The redirect allow-list already has
  `https://sift.kalpkan.com/auth/callback` and `sift://auth-callback`.
- **Cron:** `0 9 * * *` UTC on `GET /api/refresh`, registered. A manual run on 2026-11-12
  refreshed all six topics with no errors.
- **Obsidian bridge:** built and dry-run against the real vault (27 terms). **Not pushed** until
  Kalp has read the dry run (H7). The term list is never committed (public repo).
- **Taps:** each rating row stores the terms its first tap matched (`ratings.matched_terms`,
  0004; nullable since 0005, null = recompute); tap weights are derived from those rows at read
  time, never stored. Owner creation needs a Google identity AND an OAuth sign-in in the
  session's JWT `amr`; Project B must keep email confirmation on (`mailer_autoconfirm=false`).
- **Analytics:** heatmaps and dead-click capture are off site-wide; posthog-js still loads only
  after `window.load`.
- **Analytics on private pages:** none except `paper_opened {pmid}` / `paper_rated {pmid, verdict}`
  (`lib/posthog-privacy.ts`); no replay, no autocapture on `/me`, `/sign-in`, `/auth`.
- **iOS:** unchanged; simulator only until H3.

## Next steps

1. **After H6** (Kalp enables Google on Project B): sign in at `/me` with an allowed email,
   confirm a `sift.profiles` row and four `sift.follows` rows, tap 👍/👎 on 5 papers, confirm 5
   `sift.ratings` rows with `shown_rank` and `ranker_version = 'p1'`, run `npm run eval` (n=5).
   Also check a second, non-owner Google account gets the "Private" page and `403` from
   `/api/me/feed`.
2. **After H7, and before Kalp's first 👍/👎** (a tap only learns terms that exist when it is
   made): `env -u NODE_OPTIONS node --env-file=.env.local scripts/obsidian-interests.mjs --push`,
   then `curl` `/` and every `/t/<slug>` and confirm none of the pushed terms appear.
3. **Reviewer + verifier pass on Phases 2 and 3** (the plan requires it; not yet run).
4. **Phase 4 (iOS):** the last wire, `supabase-swift` Google sign-in with `sift://auth-callback`,
   bearer token to `/api/me/*`, 👍/👎, widget = personal top 3. Note for Phase 4: `/api/me/feed`
   puts the server's rank in `score` (`1 - (shownRank - 1) / N`, strictly falling), so sorting by
   `score` reproduces server order, 48-hour rule included; p1 itself is `orderScore`, h1 is `h1` /
   `h1Quality`. The app's `FeedRanking.rank` still blends in its own recency, so **the app must
   show the radar in server order (`shownRank`) and send `shownRank` exactly as given** with each
   👍/👎, or the eval's record of what was on screen is wrong (`SiftApp.swift:33`,
   `SiftWidget.swift:61` sort today).
5. Watch the cron: one `refresh_runs` row per topic per day for three days.

## How the private pieces fit (files)

- `lib/personal.ts`: `p1` = h1 + capped interest boosts (+40 max), mutes (−40 max), merged feed,
  48-hour rule, tap learning (±0.05 per matched term). MeSH is not in esummary, so terms match
  title + journal only.
- `lib/access.ts`: owner allow-list (`SIFT_OWNER_EMAILS`), 401/403 resolution, bearer parsing.
- `lib/me-api.ts`: every `/api/me/*` handler as a pure `(Request, ctx) => Response`, tested
  against an in-memory store; `lib/radar-store.ts` is the Supabase store, `lib/me-context.ts`
  wires them, `lib/auth-server.ts` reads the cookie session or bearer token.
- `lib/eval.ts` + `scripts/eval.ts`: `npm run eval`.
- `lib/cron.ts`: the daily refresh of every topic.
- `scripts/obsidian-interests.mjs`: the bridge; contract `docs/obsidian-bridge.md`.

## Exact commands

```bash
cd /Users/kalp/projects/sift
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select points at CLT
alias node='env -u NODE_OPTIONS node'; alias npm='env -u NODE_OPTIONS npm'   # cmux breaks NODE_OPTIONS
set -a; source ~/.config/portfolio-ops/secrets.env; set +a

npm test && npm run lint && npm run build && bash scripts/check-migrations.sh
npm run eval                                         # needs .env.local
node scripts/obsidian-interests.mjs                  # dry run, sends nothing
xcodebuild -project ios/Sift.xcodeproj -scheme Sift \
  -destination 'id=10A042A7-D499-4613-91D1-A52B6A9A3E10' \
  -derivedDataPath /tmp/siftdd test CODE_SIGNING_ALLOWED=NO
```

## Known issues, honestly

- **The shared ranker `h1` measures evidence tier, not importance.** `p1` adds Kalp's interests
  on top; whether that is enough is what the ratings gate decides.
- **Title cues match words, not meaning** (the "chronic ankle instability" case in `lib/ranking.ts`).
- **Abstracts are not ours to show** outside arXiv. Titles only.
- **A widget can never prove it was seen.** Engagement comes from taps and opens only.

## Two things that will cost you an hour if you forget them

1. `xcode-select -p` points at CommandLineTools; export `DEVELOPER_DIR` instead of `sudo xcode-select -s`.
2. In the cmux terminal every `node`/`npm` call dies on a missing `NODE_OPTIONS` preload; prefix with `env -u NODE_OPTIONS`.
