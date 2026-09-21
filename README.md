# Sift

PubMed publishes about **280 papers a week on neuromodulation alone**. Sift reads that list and
puts the three that matter on your iPhone's Lock Screen.

This repo is the server and the web app. The iPhone app and widget live in `ios/`.

---

## The one thing worth understanding

Fetching papers is not the product. PubMed's own email alerts already do it, for free, and have
for twenty years. **The product is the filter**, and it has two halves:

1. **A hand-tuned query per topic** (`scripts/seed-topics.mjs`). PubMed silently expands a bare
   word like `neuromodulation` into every MeSH heading and pharmacological action it can find —
   including `"neurotransmitter agents"[Pharmacological Action]`, which is why the naive query
   returns 280 papers a week, most of them pharmacology. Writing the query out by hand cuts that
   to 109. That is a 2.6x improvement before any code runs. Topics are therefore **curated by
   Kalp, not typed by users**; one person tuning five queries beats ten thousand people typing
   one each.

2. **A ranker** (`lib/ranking.ts`). It scores each paper on four free signals — publication type,
   recency, journal, and title shape — and returns *reasons* alongside the score, which the web
   page and this README both treat as a first-class feature rather than debug output.

`lib/ranking.ts` opens with an honest account of how good the ranking actually is and where it
fails. Read that before trusting it.

## What is here

| Piece | File | What it does |
|---|---|---|
| PubMed client | `lib/pubmed.ts` | `searchRecent` / `fetchSummaries`, a tolerant `pubdate` parser, and one serialising gate that keeps every call under NCBI's 3 req/s limit. No API key, no account. |
| **The ranker** | `lib/ranking.ts`, `lib/journals.ts` | `scorePaper(paper, context) -> { score, reasons }`. Pure, deterministic, and weighted from two measured publication-type distributions. |
| Feed pipeline | `lib/feed.ts` | Fetch → upsert → rank → serve, plus the 6-hour cache rule. Written against a `FeedStore` interface so the whole loop is unit-tested with no database and no network. |
| Store | `lib/supabase-store.ts`, `lib/supabase-admin.ts` | The `sift` schema over PostgREST, with the **service-role** key. Server-only; throws if it is ever evaluated in a browser. |
| API | `app/api/{feed,topics,refresh,health}/route.ts` | See below. |
| Web | `app/page.tsx`, `app/t/[slug]/page.tsx` | A journal's table of contents, not a dashboard. |
| Schema | `supabase/migrations/0002_sift_core.sql` | `topics`, `papers`, `topic_papers`, `refresh_runs`. RLS on everywhere, **no policies at all**. |
| Fixtures | `tests/fixtures/pubmed/`, `scripts/capture-fixtures.mjs` | Real recorded NCBI responses. **No test touches the network.** |
| Evaluation | `docs/eval/` | 53 real papers for Kalp to label, so the ranker can be scored against something other than its own tests. |

## The API

```
GET  /api/feed?topic=<slug>&limit=10   -> { topic, id, name, query, updatedAt, papers: [...] }
GET  /api/topics                       -> { topics: [{ slug, name, description, kind, source }] }
POST /api/refresh?topic=<slug>         -> forces a refresh. Bearer SIFT_REFRESH_TOKEN.
GET  /api/health                       -> { ok, service, db, time }   (unchanged platform contract)
```

`/api/feed` serves from Postgres and only calls PubMed when the topic's newest ranking is more
than six hours old. If PubMed is down and there is a cached feed, it serves the stale feed —
a widget showing last night's papers is a far better failure than an empty one.

Two things about the shape that are load-bearing:

- **`papers[]` matches `ios/Shared/Paper.swift` field for field.** Renaming one breaks the widget
  silently, so `lib/feed.test.ts` asserts the exact key set. Dates are full ISO 8601 with a zone,
  because Swift's `.iso8601` strategy rejects a bare `2026-09-14`.
- **`score` is quality only, in 0…1, with recency deliberately left out**, because the phone
  blends its own recency term (`FeedRanking.swift`, weight 0.35, 3-day half-life) and would
  otherwise count it twice. `orderScore` is the server's own quality+recency number, which is
  what the feed is sorted by and what the web page displays.

`POST /api/refresh` **fails closed**: with `SIFT_REFRESH_TOKEN` unset it answers 503 and refuses,
rather than being an open endpoint anyone can use to hammer NCBI from our IP.

## Security model

Every `sift` table has row level security enabled and **no policies**. That is the whole story:
an RLS-enabled table with no permissive policy returns zero rows to `anon`, so the public anon
key (still used by `/api/health`) can read nothing. All access is server-side with
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. `lib/schema.test.ts` asserts that no policy
exists, so adding one has to be deliberate.

## How to run it

Node 22.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 216 tests, no network
npm run lint
npm run build
bash scripts/check-migrations.sh
```

Without `.env.local` the site still runs: the pages say the database is not configured and
`/api/health` reports `db: "skipped"`.

To run against the real database, copy `.env.example` to `.env.local` and fill it in (values
live in Vercel and in Supabase → project "platform" → Project Settings → API). Then seed:

```bash
node --env-file=.env.local scripts/seed-topics.mjs            # checks each query live, then writes
node --env-file=.env.local scripts/seed-topics.mjs --dry-run  # just the counts
```

To re-record the PubMed fixtures (hits the live API, rate-limited, ~5 seconds):

```bash
node scripts/capture-fixtures.mjs
```

## Where the settings live

| Name | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project B's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public `anon` key. Reads nothing in this app; `/api/health` uses it. |
| `NEXT_PUBLIC_APP_SCHEMA` | `sift` |
| `NEXT_PUBLIC_APP_NAME` | Display name in the footer and `/api/health` |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Analytics; leave empty to run with it off |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Bypasses RLS. Never import `lib/supabase-admin.ts` from a client component. |
| `SIFT_REFRESH_TOKEN` | **Server-only.** Bearer token for `POST /api/refresh`. Unset = route disabled. |

Names only ever appear here and in `.env.example`; values live in Vercel and `.env.local`
(gitignored).

## Analytics

One event, `paper_opened({ topic, rank })`. It is the only observation that says the ranking did
its job, and `rank` makes "are the top three actually the ones people open?" answerable.

There is deliberately no "paper seen" event. WidgetKit has no impression, visibility or
on-screen callback of any kind (`docs/widget-constraints.md` #2), so any view count would be
invented. Taps are real; views are not.

## Cost

$0, permanently. NCBI E-utilities needs no API key. Supabase and Vercel are the existing free
tiers. There are no LLM calls anywhere in the pipeline — which is exactly why the ranker is a
heuristic, and exactly why `lib/ranking.ts` says so out loud.
