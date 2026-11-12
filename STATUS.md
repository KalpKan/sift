# Sift — status

**What this is:** Kalp's research radar (since 2026-11-12): a private feed of the week's important
papers in BCI, neural engineering, DBS and stem cells, ranked for him, on the web (`/me`) and, after
Phase 4, on his iPhone. Public pages (`/`, `/t/<slug>`) stay the generic case study.

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
| **H6** | **Turn on Google sign-in for Supabase Project B** (`platform`). Two clicks plus one paste, ~5 min: (1) Google Cloud Console → APIs & Services → Credentials → an OAuth 2.0 Web client (reuse PromptFlip's, or create "Kalp's apps") → Authorised redirect URIs → add `https://yzppfufqaekgaxcrsqxp.supabase.co/auth/v1/callback`; (2) Supabase → project `platform` → Authentication → Sign In / Providers → Google → enable, paste that client's ID and secret, save. Then open https://sift.kalpkan.com/me and sign in with masterofmath01@gmail.com or Kalpkansara123@gmail.com. | Project B's Google provider is **off** (`/auth/v1/authorize?provider=google` → `400 provider is not enabled`, checked 2026-11-12 20:52 UTC). Enabling it needs a Google OAuth client secret, which only you hold; copying PromptFlip's secret across projects was refused by the permission system. The redirect allow-list part is **done** (`https://sift.kalpkan.com/auth/callback`, `sift://auth-callback`, set via the Management API). | `/me`, every 👍/👎, and the iOS sign-in (Phase 4) |
| **H7** | **Read the Obsidian dry run, then say "push"** (or say which terms to drop). Read it by running `env -u NODE_OPTIONS node scripts/obsidian-interests.mjs` in `~/projects/sift` (sends nothing), or in the 2026-11-12 agent report. The term list is **deliberately not committed**: this repo is public, and your tags are only meant to reach your private Supabase rows. After H6 and your first sign-in, an agent (or you) runs `env -u NODE_OPTIONS node --env-file=.env.local scripts/obsidian-interests.mjs --push`. Every term stays deletable on `/me/settings`. | You asked to see exactly what leaves the vault before anything does. | Interest boosts on the radar (taps work without it) |

## Done

**v2, Phases 2 and 3 (2026-11-12):**
- Migration `0003_sift_radar.sql` applied to Project B: `profiles`, `follows`, `ratings`, `opens`,
  `interests`; owner-only RLS on `auth.uid()`, 17 policies all `to authenticated`, none for anon;
  anon key reads `[]` from all five (live check). Types regenerated.
- `lib/personal.ts` (`p1`), `/api/me/{feed,rate,open,interests,follows}` (401/403 verified live),
  `/me`, `/me/settings`, `/sign-in`, `/auth/callback`, `/auth/sign-out`, owner allow-list via
  `SIFT_OWNER_EMAILS` (set on Vercel).
- Daily cron `0 9 * * *` on `GET /api/refresh` with `CRON_SECRET` (registered; a manual run
  refreshed all six topics, 6 `refresh_runs` rows, 0 errors).
- `npm run eval` (p1 / h1 / newest-first, the 50-rating gate, leave-one-out tap learning).
- PostHog `paper_opened {pmid}`, `paper_rated {pmid, verdict}` from the radar.
- `scripts/obsidian-interests.mjs` + fixture-vault tests; real-vault dry run done, **not pushed** (H7).
- The Vercel project is now connected to `KalpKan/sift` (`vercel git connect`), so a push to
  `main` deploys; before this, pushes never deployed (see the ops runbook note of 2026-09-21).
- 331 tests, lint clean, build green, `check-migrations` extended (RLS on every table, policies
  only `to authenticated` + `auth.uid()`).

**v1 (2026-09-21):**

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
| 2026-11-12 | Phases 2 + 3 built and deployed (`5c47f2c`..`7a8c020`): radar schema, Google sign-in plumbing, p1, `/api/me/*`, `/me`, cron, eval, Obsidian bridge. Live: health ok, `/me` → `/sign-in`, `/api/me/*` 401, anon reads 0 rows. Blocked on H6 (Google provider off in Project B). Obsidian dry run: 7 research notes (5 distinct), 27 terms, nothing sent; one suggested topic. Term list kept out of this public repo. |
