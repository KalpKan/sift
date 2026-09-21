# portfolio-template

The starting point for every new hosted project on **kalpkan.com**. Press "Use this template" (or run the one command below) and you get a working Next.js site that already knows how to talk to the shared Supabase database, report its health, send analytics to the one PostHog project, and say "part of kalpkan.com" in its footer. You then only write the app itself.

What is inside:

| Piece | File | What it does |
|---|---|---|
| Next.js 16 (App Router, TypeScript, Tailwind 4) | `app/` | The site. `app/page.tsx` is the placeholder home page to replace. |
| Supabase client, scoped to this app's own schema | `lib/supabase.ts`, `lib/env.ts` | `getSupabase()` returns a client whose every query goes to the schema named by `NEXT_PUBLIC_APP_SCHEMA`, never to another app's tables. Returns `null` when the three Supabase names are unset, so the site runs without a database. |
| Placeholder database types | `lib/database.types.ts` | Replace with generated types once the schema exists (step 4 below). |
| Migration 0001 | `supabase/migrations/0001_create_schema.sql` | Creates the schema, grants it to the API roles, sets default privileges, adds a `select 1` function for the health route. Uses the placeholder `__APP__` until you rename it. |
| Health route | `app/api/health/route.ts`, `lib/health.ts` | `GET /api/health` → `{ ok, service, db: "ok" \| "skipped" \| "error", time }`. Runs `select 1` against the schema when the Supabase env is present. The hub's status badge and UptimeRobot read this. |
| PostHog analytics | `next.config.ts`, `lib/posthog.ts`, `lib/track.ts`, `lib/events.ts`, `components/PostHogProvider.tsx` | Exactly the hub's wiring: first-party `/ingest` proxy, cookieless, autocapture on, replay with inputs masked, silent no-op without a key. `lib/events.ts` has the TODO for your 2 to 4 custom events. |
| Footer | `components/Footer.tsx` | "part of kalpkan.com" linking to https://kalpkan.com, plus the app name and a link to `/api/health`. |
| Tests, lint, CI | `lib/*.test.ts`, `components/*.test.tsx`, `.github/workflows/ci.yml` | vitest + ESLint + `scripts/check-migrations.sh` + `next build` on every push. |
| Settings | `.env.example` | The five names (plus optional `NEXT_PUBLIC_APP_NAME`), no values. |

## Start a new project from this template

Everything below is copy-paste. `<app>` is the short lowercase name of the new project (`hoops`, `plantit`, ...); it is the GitHub repo name, the Vercel project name, the Supabase schema name and the subdomain, all the same word.

1. **Create the repo and clone it** (the `--template` flag copies this repo's files with a fresh history):
   ```bash
   gh repo create KalpKan/<app> --template KalpKan/portfolio-template --public --clone
   cd <app> && npm install
   ```
2. **Name it.** Replace the placeholder schema name in the migration, and put the same word in `.env.local` for local runs:
   ```bash
   sed -i '' 's/__APP__/<app>/g' supabase/migrations/*.sql
   grep -rn __APP__ supabase/ || echo "clean"
   cp .env.example .env.local     # then fill NEXT_PUBLIC_APP_SCHEMA=<app>; leave the rest empty for now
   ```
   Also change `"name"` in `package.json` and the title text in `app/page.tsx`.
3. **Create the schema in Supabase Project B** (only if the app needs a database; skip to step 5 otherwise). Follow the runbook **"Add a schema to Supabase Project B"** in `KalpKan/portfolio` → `skills/portfolio-ops/runbooks.md`: it applies `supabase/migrations/*.sql` through the Management API, then **exposes the schema** in Project Settings → Data API → Exposed schemas (the migration file explains why). Never create a new Supabase project; there are exactly two, forever.
4. **Generate the database types** so queries are type-checked against the real tables:
   ```bash
   npx supabase@2 gen types typescript --project-id yzppfufqaekgaxcrsqxp --schema <app> > lib/database.types.ts
   ```
   (needs `SUPABASE_ACCESS_TOKEN` in the environment: `set -a; source ~/.config/portfolio-ops/secrets.env; set +a`). Then in `lib/supabase.ts` change `export type Schema = string` to `export type Schema = "<app>"`. Re-run this command after every migration.
5. **Analytics events.** Open `lib/events.ts`, rename the example to the app's core action, and call it from the component that performs the action. Names are `snake_case`, past tense, 2 to 4 per app (`KalpKan/portfolio` → `docs/analytics.md`).
6. **Check it locally:** `npm test && npm run lint && npm run build`, then `npm run dev` and open http://localhost:3000/api/health. With the Supabase names empty it says `"db":"skipped"`; with them filled in and the schema exposed it says `"db":"ok"`.
7. **Deploy to Vercel** (see "How to deploy this" below), then **add the subdomain** with the runbook "Attach a domain to a Vercel project" (`<app>.kalpkan.com`).
8. **Add it to the hub.** Add this to `projects.json` in `KalpKan/portfolio` (runbook "Add a project to `projects.json`"):
   ```json
   {
     "slug": "<app>",
     "name": "<App name>",
     "tagline": "One sentence about what it does.",
     "type": "app",
     "status": "live",
     "url": "https://<app>.kalpkan.com",
     "repo": "https://github.com/KalpKan/<app>",
     "healthUrl": "https://<app>.kalpkan.com/api/health",
     "tags": ["Next.js", "Supabase"],
     "hero": null
   }
   ```
   Then add an UptimeRobot monitor on the `healthUrl` (runbook "Add an UptimeRobot monitor") and the app's row to `skills/portfolio-ops/SKILL.md` and `settings-map.md`.

## How to run this

You need Node 22 (`node -v`). Then, in the project folder:

```bash
npm install        # once, downloads the libraries
npm run dev        # starts the site at http://localhost:3000; Ctrl+C stops it
npm test           # runs the automatic checks (should say "passed")
npm run build      # makes the production version; this is what Vercel runs
```

No `.env.local` is needed to run it: without one the site works, the database is off (`/api/health` says `"db":"skipped"`), and analytics is off.

## How to deploy this

Vercel builds and hosts it for free (Hobby plan, non-commercial). Two ways:

- **Dashboard (once per project):** https://vercel.com/new → Import the GitHub repo → team "Kk's projects" → Deploy. From then on every push to `main` deploys automatically.
- **Command line:** `npx vercel@latest deploy --prod --yes --scope kks-projects-2edcb11a` from the project folder (the first run asks to create/link the project; answer with the `<app>` name).

After the first deploy, set the environment variables (next section) and redeploy once: `NEXT_PUBLIC_*` values are baked in at build time, so changing them without a redeploy changes nothing.

## Where the settings live

| Name | What it is | Where the real value lives |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project B's URL (`https://yzppfufqaekgaxcrsqxp.supabase.co`) | Vercel → your project → Settings → Environment Variables (Production + Preview) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project B's public `anon` key (safe in the browser; row-level security protects data) | same |
| `NEXT_PUBLIC_APP_SCHEMA` | This app's schema name, `<app>` | same |
| `NEXT_PUBLIC_APP_NAME` | Optional display name for the footer and `/api/health` | same |
| `NEXT_PUBLIC_POSTHOG_KEY` | The public `phc_` token of the "Kalp portfolio" PostHog project | same (add with `--type config` when using the CLI, see docs/analytics.md in the hub) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Always `/ingest` | same |

Locally the same names go in `.env.local` (copy `.env.example`), which git ignores. Names only ever go in this README and in `.env.example`; values live only in Vercel. If a value leaks, rotate it in Supabase/PostHog and update Vercel (runbook "Rotate a secret").

## Verified

_2026-09-18 (T1.2). The template was used to spin up a throwaway app end to end, timed, then the throwaway was removed. No Supabase schema was created for this (health answers `db: "skipped"` without the env), and nothing was spent._

**Elapsed: 10 min 05 s** from "create the repo from the template" to "curl the live health route" (well under the 15-minute bar). Almost all of it was waiting on Vercel: the build itself took 16 s, but the Hobby team runs one build at a time and four other projects were deploying at the same moment, so the second deploy sat in the queue for about six minutes. On a quiet team the same run is roughly 3 minutes.

| Step | Command | Result | Clock |
|---|---|---|---|
| Create from template | `gh repo create KalpKan/template-smoke --template KalpKan/portfolio-template --public --clone` | repo created `20:17:48Z`, pushed `20:17:52Z` (start marker `20:17:46Z`) | 6 s |
| Clone + install | `gh repo clone KalpKan/template-smoke && npm ci` | `found 0 vulnerabilities` | T+6 s |
| Tests | `npm test` | `Test Files 7 passed (7)` · `Tests 28 passed (28)` | T+9 s |
| Build | `npm run build` | `✓ Compiled successfully in 2.6s` · routes `○ /`, `○ /_not-found`, `ƒ /api/health` | T+16 s |
| Deploy | `npx vercel@latest deploy --prod --yes --scope kks-projects-2edcb11a` (run from the `template-smoke` folder, so the project is named after it) | project `template-smoke` created; first call reported `Error: fetch failed` after the upload but the deployment still built (`● Ready`, 40 s); the retry queued behind other builds and came back `● Ready` in 16 s | T+590 s |
| Health | `curl https://template-smoke.vercel.app/api/health` | `{"ok":true,"service":"template","db":"skipped","time":"2026-09-18T22:05:02.955Z"}` · `HTTP 200` · `cache-control: no-store`. Note: this body was re-captured at 22:05Z just before teardown, not at T+599 s; the original T+599 s response (about 20:27:45Z) had the same `ok`, `service`, `db` fields and the same status and headers, only its `time` value differed. The 10 min 05 s figure comes from the start marker `20:17:46Z` and the first successful health curl, not from the pasted `time`. | T+599 s |
| Footer | `curl https://template-smoke.vercel.app/ \| grep kalpkan` | `href="https://kalpkan.com"` · `part of kalpkan.com` | |
| PostHog proxy | `curl -o /dev/null -w '%{http_code} %{content_type}' https://template-smoke.vercel.app/ingest/static/array.js` | `200 application/javascript` (313 KB of posthog-js served through the app's own origin) | |
| Clean-up | `printf 'y\n' \| npx vercel@latest project rm template-smoke --scope kks-projects-2edcb11a` | `Success! Project template-smoke removed`; `https://template-smoke.vercel.app` → 404 | |

The throwaway GitHub repo `KalpKan/template-smoke` was archived rather than deleted: the `gh` login on this Mac has the `repo` scope but not `delete_repo`, and adding a scope is an account-level permission only Kalp should grant. To delete it: `gh auth refresh -h github.com -s delete_repo` (one browser click), then `gh repo delete KalpKan/template-smoke --yes`.

Note for the next spin-up: `vercel deploy` printing `Error: fetch failed` right after the upload does not mean the deploy failed. Run `npx vercel@latest ls <project> --scope kks-projects-2edcb11a` before retrying; if it already says `● Ready`, you are done.
