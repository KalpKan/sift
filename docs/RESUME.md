# Sift — pick up here

*Last updated 2026-11-12. `docs/spec.md` (last section) says what v2 is, `docs/plan.md` §8
how it fits, `docs/obsidian-bridge.md` the privacy rules. This file is only "what is true right
now and what to do next". The build plan approved by Kalp is
`~/.claude/plans/i-need-a-place-fluttering-eagle.md`.*

## What Sift is now

Kalp's own research radar: a private feed of the week's important papers in brain-computer
interfaces, neural engineering, deep brain stimulation and stem cells, on the web (`/me`) and
on his iPhone (app + widget), ranked for him and learning from his 👍/👎 taps and from his
`[[research]]`-tagged Obsidian notes. Public pages stay as the generic case study.

## What is true right now

- **Live:** https://sift.kalpkan.com — `/`, `/t/<slug>`, `/api/feed`, `/api/topics`,
  `/api/refresh`, `/api/health`. Health green, UptimeRobot `804044195`.
- **Database:** Supabase Project B (`yzppfufqaekgaxcrsqxp`), schema `sift`: `topics`, `papers`,
  `topic_papers`, `refresh_runs`. RLS on, no policies.
- **iOS:** simulator only until Kalp buys the Apple Developer Program (STATUS.md H3).

## Build order (each phase: build → reviewer → verifier)

1. **Phase 1 — topics.** Add `stem-cells` to `scripts/seed-topics.mjs`, measured with `--dry-run`.
2. **Phase 2 — accounts, ratings, personal ranker.** Migration `0003_sift_radar.sql`, Google
   sign-in, `lib/personal.ts` (`p1`), `/api/me/*`, `/me`, `/me/settings`, daily cron,
   `npm run eval`. Deploy when green.
3. **Phase 3 — Obsidian bridge.** `scripts/obsidian-interests.mjs`; show Kalp the dry run before
   the first `--push`.
4. **Phase 4 — iOS.** The last wire (`FeedModel` → `SiftAPI` → `SharedStore` → widget reload,
   samples as the failure path; keep `SiftAPI.decoder()`'s two ISO 8601 shapes), Google sign-in,
   👍/👎, personal widget. Device install after H3.

## Exact commands

```bash
cd /Users/kalp/projects/sift
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select points at CLT
alias node='env -u NODE_OPTIONS node'; alias npm='env -u NODE_OPTIONS npm'   # cmux breaks NODE_OPTIONS
set -a; source ~/.config/portfolio-ops/secrets.env; set +a

npm test && npm run lint && npm run build && bash scripts/check-migrations.sh
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
