# Sift — pick up here

*Last updated 2026-09-21 (overnight planning session). The full design is `docs/plan.md`;
this file is only "where things are and what to type next". `STATUS.md` in the repo root
carries the human checkpoints H1 to H4 and the session log; keep the two in step.*

## Current state

- **Product:** Sift, an iOS widget showing the week's important papers in a field. The ad
  idea is dead (`docs/why-not-ads.md`); do not re-propose it.
- **Repo:** `KalpKan/sift` (public), local `/Users/kalp/projects/sift`, from the portfolio
  template (Next.js 16, TypeScript, Tailwind 4, vitest, zod, CI). Latest commit:
  `155599e Pivot: AdSpace becomes Sift`. **A lot is uncommitted** (other agents' work
  from the same night): `ios/` (Xcode project with `Sift`, `SiftWidget`, `SiftTests`
  targets and `Shared/` models, store, ranking, deep link), `lib/pubmed.ts` + tests +
  recorded fixtures in `tests/fixtures/pubmed/`, `supabase/migrations/0002_sift_core.sql`
  + `lib/schema.test.ts`, regenerated `lib/database.types.ts`, a rewritten `STATUS.md`,
  `docs/widget-constraints.md`, and these two docs. Run `npm test` and the xcodebuild line
  below before committing any of it.
- **Database:** Supabase Project B (`platform`, ref `yzppfufqaekgaxcrsqxp`), schema `sift`,
  exposed to PostgREST. Migrations `0001` and `0002` are **applied**: tables `topics`,
  `papers`, `topic_papers`, `refresh_runs` exist with **0 rows**; RLS on, no policies
  (server-only access via the service-role key). Migration `0003` (journals cache, labels,
  evaluations, `ranker_version`) is sketched in `docs/plan.md` §3.2 and not yet written.
- **Server code:** `lib/pubmed.ts` is done (esearch + esummary, rate-limit queue, no
  abstracts). **Not yet:** `lib/openalex.ts`, `lib/ranking.ts`, the feed route, the `/t/<topic>`
  page, the `/label/<topic>` page, `npm run eval`, `scripts/seed-topics.ts`.
- **iOS:** shell builds and tests headlessly. App → `SharedStore` (App Group with a local
  fallback) → widget, with `FeedRanking` blending server quality and recency on-device. The
  app has **no network layer yet** (`publishToWidget()` seeds sample data).
- **Hosting:** not deployed. No Vercel project, no `sift.kalpkan.com` record, no UptimeRobot
  monitor, no `projects.json` entry. **Budget: 2 deploys this session.**
- **Key measured facts** (details and commands in `docs/plan.md` appendix): `neuromodulation`
  = 280 papers/7 days but `neuromodulation[tiab]` = 88; about half of week-1 papers have no
  publication type yet; OpenAlex citation counts are zero for essentially every paper in its
  first 30 days (useless for ranking, useful for evaluation); OpenAlex lags PubMed by days.

## Exact next commands

```bash
# 0. Environment (every new shell)
cd /Users/kalp/projects/sift
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select points at CLT
set -a; source ~/.config/portfolio-ops/secrets.env; set +a         # SUPABASE_ACCESS_TOKEN etc.

# 1. Sanity
npm test && npm run lint && bash scripts/check-migrations.sh
git status --short                                                  # expect ios/ and docs/widget-constraints.md untracked until committed

# 2. iOS shell builds and tests headlessly (once the other agent has finished ios/)
xcodebuild -project ios/Sift.xcodeproj -scheme Sift \
  -destination 'platform=iOS Simulator,name=iPhone 16' test 2>&1 | tail -20

# 3. P0 step 1: write supabase/migrations/0003_sift_eval.sql from plan.md §3.2, extend
#    lib/schema.test.ts, then apply it (runbook "Add a schema to Supabase Project B", step 2;
#    [] means success). 0001 and 0002 are already applied — do not re-run them.
q(){ curl -s -X POST https://api.supabase.com/v1/projects/yzppfufqaekgaxcrsqxp/database/query \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$1" '{query:$q}')"; }
q "$(cat supabase/migrations/0003_sift_eval.sql)"
q "select table_name from information_schema.tables where table_schema='sift' order by 1" | jq -c '.[]'

# 4. Regenerate types (runbook "Regenerate Supabase types")
npx supabase@2 gen types typescript --project-id yzppfufqaekgaxcrsqxp --schema sift > lib/database.types.ts

# 5. Then in order (plan.md §5, P0): scripts/seed-topics.ts (field-tagged queries)
#    → lib/openalex.ts → lib/ranking.ts (h1, tested) → app/api/feed/[topic]/route.ts
#    (JSON must match ios/Shared/Feed.swift; score served as 0..1) → app/t/[topic]
#    → app/label/[topic] + npm run eval → FeedModel.publishToWidget() fetches the route
#    and saves to SharedStore; prove it in the simulator.

# 6. Deploy 1 (after the feed route works locally). First run creates the Vercel project "sift".
npx vercel@latest deploy --prod --yes --scope kks-projects-2edcb11a
#    Env vars to set first (names only; values piped, never echoed — runbook "Rotate a secret"):
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_SCHEMA=sift,
#    SUPABASE_SERVICE_ROLE_KEY (server only), SIFT_ADMIN_TOKEN (openssl rand -hex 32),
#    NEXT_PUBLIC_POSTHOG_KEY (--type config), NEXT_PUBLIC_POSTHOG_HOST=/ingest
#    Then: runbook "Attach a domain to a Vercel project" for sift.kalpkan.com (DNS-only, grey cloud),
#    runbook "Add an UptimeRobot monitor" on https://sift.kalpkan.com/api/health,
#    runbook "Add a project to `projects.json`", rows in settings-map.md and SKILL.md system map.

# 7. Deploy 2: after /label and the eval script. That is the session's deploy budget.
```

## Blocked on Kalp

| # | What | Why only he can decide | Blocks |
|---|---|---|---|
| H1 | **Apple Developer Program, $99 USD/year** | Money, and it is his account | Real-device install, lock-screen widget in real conditions, App Groups, TestFlight, App Store. **Not** P0 or most of P1 (simulator only). |
| Q1 | Which fields he actually follows (the seeded three are guesses) | Only he knows | The E1 labelling pass in P0 is meaningless in a field he does not read |
| Q2 | His definition of "important" (clinician / student / researcher lens) | Personal | The `h1` study-type weights |
| Q3 | Public showcase feed vs. private | Portfolio choice | RLS policy on `topic_papers` (plan assumes public read) |
| Q4 | Any LLM spend, ever, even opt-in | Money | Whether P2 option 3 exists at all |
| Q5 | Create a free NCBI account for an API key (optional) | His account | Raises PubMed limit 3 → 10 req/s; not required |
| Q6 | Two or three lab-mates willing to label 100 papers | His network | Whether E1 ever has more than one labeller |
| Q7 | Preprints (bioRxiv/medRxiv via Europe PMC) in or out | Taste | A P1 source; PubMed itself has almost none |
| Q8 | The name "Sift" (taken by several products) | Branding | Must be settled before H1, never after |
| H2 | **25 minutes of labelling** at `/label/<topic>` once Deploy 2 is up (100 papers; 50 is the floor STATUS.md names) | It is the ground truth | The first real number for the ranker (plan.md §4.5, E1) |
