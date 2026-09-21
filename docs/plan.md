# Sift — architecture and roadmap

*Written 2026-09-21 by the planning agent. Every number in here was measured live against
PubMed and OpenAlex that night, with no API key; the commands are in the appendix so the
numbers can be re-checked. Read `why-not-ads.md` for how we got here and
`widget-constraints.md` for what a widget physically can and cannot do.*

---

## 1. The shape of the thing

**Sift is an iPhone widget that shows a researcher the two or three papers from this week
that are actually worth their time, in the field they follow.** You pick a field
("neuromodulation", "brain-computer interfaces", "spinocerebellar ataxia"). A small tile on
your home screen, and a two-line strip on your lock screen, shows the newest important papers.
You tap one and the paper opens. That is the whole product.

**Who it is for.** Clinician-researchers and grad students who already know their field and
already skim PubMed, but do it badly: in bursts, weeks late, and mostly by scrolling past
everything. The lock screen is the one surface they look at fifty times a day without meaning
to. Sift borrows about two seconds of that.

**What makes it different from a PubMed email alert.** Be honest here, because the answer
decides whether this is a product or a demo.

A PubMed "My NCBI" alert emails you *everything* that matched, in date order. For
"neuromodulation" that was 280 papers last week. Nobody reads that email; it becomes an unread
thread called "What's new for neuromodulation" that gets archived on sight. Google Scholar
alerts are the same with a slightly better relevance sort.

So the difference has to be **the filter**: Sift shows three, not 280, and the three are
chosen, not just newest. If the chooser is good, this is a product. If the chooser is just
"newest three", this is a worse PubMed alert with a nicer font and the user will stop looking
in about a week.

The honest state today: **we have not built the chooser yet, and a free chooser will be
decent at throwing out junk but mediocre at finding the gem.** Section 4 explains exactly
why, with numbers, and section 4.5 says how we will know. Two things would change "not much
yet" into "a real difference":

1. **Fixing the query itself** (already a measured 3x win, see 4.1). Most of the 280 is
   PubMed quietly expanding the word into "neurotransmitter agents" and returning
   pharmacology papers. Requiring the term in the title or abstract cuts it to 88.
2. **Learning from the reader** (P1): "boost these words, mute those", plus what they tap.
   A generic ranker cannot know that Kalp cares about *closed-loop* stimulation and not
   *pharmacological* neuromodulation. The reader can tell it in ten seconds.

The secondary reason to build it anyway: it is a clean, defensible portfolio piece
(iOS + WidgetKit + a ranking pipeline with a measured evaluation) that sits on
`sift.kalpkan.com` alongside the others, and it is something Kalp will personally use every
day, which is the only kind of side project that survives.

---

## 2. Architecture

### 2.1 The decision: the server does the work, the widget only reads

```
                       once a day (Vercel cron, P1) or on demand when a feed is stale (P0)
                                              |
  PubMed E-utilities  -----> [ Next.js route on Vercel: /api/feed/<topic> ] <-----  OpenAlex
  (esearch + esummary)       |   1. fetch the last 7 days for the topic         (journal metrics,
  free, no key needed        |   2. enrich with cached journal metrics           cached for months)
                             |   3. score every paper   (lib/ranking.ts, versioned)
                             |   4. store papers + scores in Supabase `sift`
                             |   5. answer a small JSON: the top N with title,
                             |      journal, DOI, age, score breakdown
                             v
             +-----------------------------+        +-----------------------------------+
             | Supabase Project B, `sift`  |        | sift.kalpkan.com (same Next.js app)|
             | topics, papers, scores,     |        |  /t/<topic>   ranked list + why    |
             | journals cache, labels,     |        |  /label/<topic>  Kalp's hand-labels|
             | ranker runs, evaluations    |        |  /api/health  platform contract    |
             +-----------------------------+        +-----------------------------------+
                                              |
                                              v   one small GET, a few times a day, ~2 KB
                    +----------------------------------------------------+
                    | iPhone                                              |
                    |  App: downloads the feed, writes feed.json to the   |
                    |    App Group store, tells the widget to reload;     |
                    |    opens the tapped paper; manages topics (P1)      |
                    |  Widget (home + lock screen): reads feed.json,      |
                    |    blends quality with recency, shows the top 3     |
                    +----------------------------------------------------+
```

**Why not have the iPhone call PubMed directly?** Four reasons, any one of which is enough.

- **The ranking has to live somewhere it can be changed without an App Store release.** A
  ranker is a thing you tune weekly. On the server it is a `git push`; in the app it is a
  review cycle, and today Kalp cannot even ship to the App Store (no developer membership).
- **PubMed's rate limit is per IP, 3 requests a second without a key.** Fetching 88 papers
  and their abstracts is 2 to 4 calls; ranking needs journal metrics from OpenAlex, which is
  another call per unseen journal. On the phone every user repeats that work; on the server
  it happens once per topic per day and is shared by everyone.
- **The widget cannot do heavy work.** It gets 40 to 70 refreshes a day, runs in a process
  with roughly a 30 MB memory ceiling, and cannot run code while on screen
  (`widget-constraints.md`). A 2 KB JSON of three pre-ranked papers is exactly the shape of
  thing it can handle.
- **Kalp wants a web presence for the portfolio anyway.** The server that ranks is also the
  website: `/t/neuromodulation` shows the ranked list with the score breakdown per paper,
  which doubles as the debug view and the case study.

**How the phone side works (already built in `ios/`, keep it).** `widget-constraints.md`
is right that a widget should not fetch, and the shell another agent built tonight follows
it: the **app** downloads the prepared feed JSON, writes it to one file in the App Group
container (`SharedStore`, `group.com.kalpkan.sift`), and calls
`WidgetCenter.reloadTimelines`; the **widget** only reads that file. The app does not have a
network layer yet (it seeds sample data); wiring `GET /api/feed/<topic>` into
`FeedModel.publishToWidget()` is P0 work.

Two honest caveats about that design, both already handled in code:

- **An App Group is an entitlement, and without the $99 membership there is none on a real
  device.** `SharedStore` falls back to an app-private folder when the container is missing,
  which keeps the app testable, but in that state the widget cannot see what the app wrote
  and silently shows sample data. The iOS Simulator is lenient about the entitlement, so the
  loop can be proven there. If it turns out not to be, plan B is the widget fetching the
  2 KB JSON itself inside `getTimeline` (Apple's own samples do this; 8 refreshes a day
  against a budget of 40 to 70), with the topic chosen in the widget's own configuration.
  Same JSON, different downloader, no rewrite.
- **Recency is applied on the phone, not the server.** `FeedRanking.swift` blends the
  server's `score` (quality, 0 to 1) with an exponential recency term (weight 0.35, three-day
  half-life) at display time. So the server score must be **quality only** (section 4.3),
  and the website's list must use the same blend so the two never disagree about what is
  first.

### 2.2 What each part is, in plain words

| Part | What it is | Where | Cost |
|---|---|---|---|
| **Fetcher** | Asks PubMed "what is new for this topic in the last 7 days" and gets titles, journal, ISSN, authors, publication types, language, indexing status (built: `lib/pubmed.ts`, esearch + esummary; abstracts need `efetch`, P1) | Vercel | $0 (free API, optional free key) |
| **Enricher** | Looks up each journal's OpenAlex metrics once, caches for 90 days | `lib/openalex.ts` + `sift.journals` | $0 (CC0 data, polite-pool needs only an email) |
| **Ranker** | A pure function: paper + journal metrics + topic → a score and a breakdown of why. Versioned (`ranker_version = "h1"`) so scores from different versions are never compared by accident | `lib/ranking.ts` | $0 |
| **Store** | Supabase Project B, schema `sift` (section 3) | shared project | $0 |
| **Feed route** | `GET /api/feed/<topic>?n=10` → JSON in the exact shape `ios/Shared/Feed.swift` decodes (`id, name, query, papers[], updatedAt`; `score` as a 0-to-1 double). If the topic was refreshed in the last 6 h, serve from the store; else fetch + rank first (lazy refresh; a daily cron pre-warms in P1) | `app/api/feed/[topic]/route.ts` | $0 |
| **Web** | `/t/<topic>`: the same list, human-readable, with the score breakdown; `/label/<topic>`: Kalp's labelling page | `app/t/…`, `app/label/…` | $0 |
| **Widget** | `SiftWidget` target (built): reads `SharedStore`, ranks with `FeedRanking`, medium home-screen + `accessoryRectangular` lock screen, whole-widget tap deep-links `sift://paper/<id>` | `ios/SiftWidget` | $0 (simulator only until H1) |
| **App** | `Sift` target (built, no network yet): `FeedModel` loads the store, handles the deep link, opens the paper URL; P0 adds the fetch of `/api/feed/<topic>` and the write to the store | `ios/Sift` | $0 |

**Vercel Hobby budget check.** 1 M function calls and 4 CPU-hours a month. A widget refreshing
every 3 h is 8 calls a day per widget; one hundred users would be 24 k calls a month. The
fetch-and-rank for one topic is a few seconds of CPU once a day. Nothing here approaches a
limit; the only Hobby rule that bites is "cron once per day", which is exactly the cadence we
want.

**PubMed etiquette.** Every call carries `tool=sift&email=<Kalp's address>` as NCBI asks; a
free NCBI API key (needs an NCBI account, open question Q5) raises the limit from 3 to 10
requests a second. Everything is cached server-side, so users never hit PubMed directly.

---

## 3. The `sift` Supabase schema

House rules applied: everything lives in schema `sift`, never `public`; row-level security
(RLS, the database's own per-row permission system) is enabled on every table; every foreign
key gets an index; if money ever appears it is whole cents in an `integer`, never a decimal
(there is no money in Sift, so no such column exists).

### 3.1 What already exists (migration `0002_sift_core.sql`, applied to Project B tonight)

Another agent wrote and applied it; `lib/schema.test.ts` pins its shape and the tables are
live with zero rows (checked via the Management API: `papers`, `refresh_runs`, `topic_papers`,
`topics`; `sift` is in the exposed-schema list). Build on it, do not redo it.

| Table | Key columns | Notes |
|---|---|---|
| `topics` | `id uuid`, `slug` unique, `name`, `pubmed_query` (the hand-tuned string sent verbatim), `source` (`pubmed` \| `arxiv`), `is_active` | Curated by Kalp, seeded by a script; no free-text topic box, which is a product decision I agree with (section 4.1 is the evidence) |
| `papers` | `pmid text` pk, `title`, `journal`, `authors text[]`, `doi`, `url`, `published_on date`, `pub_types text[]`, `first_seen_at`, `raw jsonb` | `raw` keeps the whole esummary record, which already contains `issn`, `essn`, `lang`, `recordstatus`, so `h1` can read those without a new column. **No abstract**: esummary does not return one |
| `topic_papers` | `(topic_id, pmid)` pk, `score integer`, `score_reasons jsonb`, `ranked_at` | The product. Index `(topic_id, score desc)` answers the feed query |
| `refresh_runs` | per-topic audit rows with `papers_seen`, `papers_added`, `error` | So a broken fetch and a quiet week never look the same |

**RLS posture, as built:** RLS on, **no policies at all**, on every table. That means the
public anon key can read nothing; every read and write goes through the server with
`SUPABASE_SERVICE_ROLE_KEY`. The website renders server-side with that key, so the public
page still works. This is stricter than my first sketch (public-read policies) and it is the
better default; open question Q3 becomes "add a public-read policy later, or not".

**Two things to settle in P0 code, not in SQL:** `score` is an `integer` while the phone
expects a 0-to-1 double, so define the convention once (store `round(score * 1000)`, serve
`score / 1000`); and `published_on` is normalised to the first of the month when PubMed only
gives a month, so the phone's recency term should be fed `first_seen_at` for anything with
`datePrecision != "day"`.

### 3.2 What P0 adds (`0003_sift_eval.sql`, sketch)

```sql
-- Journal-level metrics from OpenAlex, cached. Keyed by ISSN because that is what
-- PubMed gives us on day one (esummary `issn` / `essn`, kept in papers.raw).
create table sift.journals (
  issn          text primary key,
  openalex_id   text,
  name          text,
  citedness_2y  numeric,          -- OpenAlex 2yr_mean_citedness, an impact-factor-like number
  h_index       integer,
  in_doaj       boolean,
  refreshed_at  timestamptz not null default now()
);
alter table sift.journals enable row level security;

-- Human ground truth. In P0 the only labeler is "kalp" (writes go through a server route
-- guarded by SIFT_ADMIN_TOKEN); in P1 `labeler` becomes auth.uid()::text under RLS.
create table sift.labels (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references sift.topics (id) on delete cascade,
  pmid        text not null references sift.papers (pmid) on delete cascade,
  labeler     text not null,
  verdict     text not null check (verdict in ('read', 'skip')),
  created_at  timestamptz not null default now(),
  unique (topic_id, pmid, labeler)
);
alter table sift.labels enable row level security;
create index labels_topic_id_idx on sift.labels (topic_id);
create index labels_pmid_idx     on sift.labels (pmid);

-- One row per evaluation run (section 4.5), kept forever: the case-study table.
create table sift.evaluations (
  id              uuid primary key default gen_random_uuid(),
  ranker_version  text not null,
  topic_id        uuid references sift.topics (id) on delete set null,
  metrics         jsonb not null,   -- {p_at_5, p_at_5_recency, p_at_5_random, base_rate, ndcg_at_5, n_labels}
  ran_at          timestamptz not null default now()
);
alter table sift.evaluations enable row level security;
create index evaluations_topic_id_idx on sift.evaluations (topic_id);

-- Versioning the scores: add to topic_papers so h1 and h2 are never compared by accident.
alter table sift.topic_papers add column ranker_version text not null default 'h1';

-- Still no policies. lib/schema.test.ts should be extended to cover 0003.
```

Deferred, on purpose: `papers.abstract` (needs `efetch`, P1, and it is what a future
abstract-reading ranker needs); `subscriptions` and `profiles` (need Supabase auth, P1);
an `arxiv` source row (the `source` column already anticipates it).

**Two consequences worth saying out loud.**

- **New secrets.** The feed route writes, so the Vercel project needs `SUPABASE_SERVICE_ROLE_KEY`
  server-side (never `NEXT_PUBLIC_`), plus `SIFT_ADMIN_TOKEN` for the labelling route. Both get
  rows in `settings-map.md` per the ops "Update rule"; the pattern for setting them without
  printing them is under runbook "Rotate a secret".
- **Storage in the shared project.** Project B has 500 MB for every app. A `raw` esummary
  record is about 1.5 KB; 90 papers a week times five topics is roughly 35 MB a year, fine,
  but abstracts (P1) triple that. Rule: null `raw` and `abstract` after 90 days unless the
  paper has a label (a tiny cleanup in the P1 cron). Never delete labelled rows.

---

## 4. The ranking design

This is the whole company, so it gets the most honest treatment.

### 4.1 First: fix the query, because two thirds of the noise is the query

Measured 2026-09-21, papers added to PubMed in the previous 7 days:

| Search | 7 days | 30 days | What changed |
|---|---|---|---|
| `neuromodulation` | **280** | 1,265 | PubMed auto-expands to "neurotransmitter agents" (MeSH) and returns drug papers |
| `neuromodulation[tiab]` (word must be in the title or abstract) | **88** | 324 | 3.2x fewer, and they are actually about neuromodulation |
| `neuromodulation[ti]` (title only) | 12 | 71 | too strict for a weekly feed |
| `brain-computer interface` → `[tiab]` variants incl. `BCI` | 31 → 23 | 144 → 101 | smaller effect; the term is more specific |
| `spinocerebellar ataxia` → `[tiab]` | 4 → 3 | 33 → 26 | tiny field; the problem there is the opposite (too few) |
| `deep brain stimulation` → `[tiab]` | 37 → 28 | 119 → 90 | |

So the true problem is "which 3 of 88", not "which 3 of 280", and it varies by field: for
spinocerebellar ataxia the honest widget shows *everything* (3 to 4 a week) and ranking barely
matters. **The query string is stored per topic (`topics.query`), so tuning it is data entry,
not a deploy.** Rule for every topic: field-tag the terms (`[tiab]`), add the obvious
synonyms and abbreviations, and drop `[majr]` (major MeSH topic), which returned zero for
the last 7 days because MeSH indexing has not happened yet for new papers.

### 4.2 What signals are actually available in a paper's first week

This is the part most "rank the literature" plans get wrong: they assume the metadata that
exists for a 2-year-old paper exists for a 2-day-old one. It does not. Measured on 60 papers
from the last 7 days:

| Signal | Available in week 1? | Evidence | Verdict |
|---|---|---|---|
| Title, abstract | Yes (59/60 had an abstract), but only `efetch` returns the abstract; the built client uses `esummary` (no abstract) | efetch | Title now; abstract in P1 |
| Journal (name + ISSN) | Yes, always | esummary | **Strongest usable signal** |
| Publication type (RCT, Review, Case Report, …) | **About half.** 34/60 were already MEDLINE-indexed with types; 17 were "as supplied by publisher" with only "Journal Article" | esummary `pubtype` + `recordstatus` | Use, but the default for "unlabelled" must be neutral, and papers must be **re-scored daily** as labels arrive |
| MeSH terms | Same half | efetch | P1: "Humans" vs "Animals" |
| Citation count (OpenAlex) | **No.** 0 of 82 works from the last 7 days had a single citation; 1 of 533 in the last 30 days | OpenAlex `cited_by_count` | **Useless for the widget's timescale.** Valuable for *evaluation* (section 4.5) |
| Work exists in OpenAlex at all | Partly. OpenAlex had 82 works for the week where PubMed had 280 (or 88 field-tagged); a 1-day-old DOI returned 404 | OpenAlex works | Do not depend on it in pass 1; use as a **second pass** days later |
| Journal-level metrics (OpenAlex `2yr_mean_citedness`, h-index) | Yes, stable for months | OpenAlex sources by ISSN | Use, cache 90 days |
| Author prominence (h-index of last author) | Only once the work is in OpenAlex with resolved author IDs; name search without that is unreliable | OpenAlex authors | P1 second pass; probably the best signal we are *not* using on day one |
| Preprint vs published | PubMed indexes almost no preprints (1 of 1,265 in 30 days) | esearch `preprint[pt]` | Not a signal in PubMed; preprints would need Europe PMC (open question Q7) |
| "Unusual terms vs the field baseline" (novelty) | Computable, but in practice it surfaces typos, species names and off-topic papers | reasoning, not measured | **Skip.** Replace with reader-supplied boost/mute words in P1 |
| Registered trial number (NCT…), sample size in abstract | Cheap regex | reasoning | P1 minor bonus |
| Free full text (PMC) | Yes | esummary `articleids` | Not "importance"; show an icon, do not score it |

Distribution of publication types when they are known (neuromodulation, 30 days, n = 1,265):
Review 24 %, RCT 5 %, Systematic Review 3 %, Meta-Analysis 2 %, Case Reports 4 %,
Editorial/Comment/Letter 2 %. So the "negative" filters (case reports, letters, errata) only
remove about 6 %; the bulk of the win is in the journal tier and topic match.

### 4.3 The scoring function, version `h1`

A pure function `rank(paper, journal, topic) -> { score, reasons }` in `lib/ranking.ts`
(the file `0002` already names). Every term is in `[0, 1]`; weights sum to 1; penalties
subtract; the result is clamped to `[0, 1]` and stored as `round(score * 1000)`.

```
quality = 0.40 * journal_tier
        + 0.33 * study_type
        + 0.27 * topic_match
        - penalties

shown   = 0.65 * quality + 0.35 * recency        <- computed on the phone by FeedRanking.swift
                                                    (and identically on the website), NOT stored
```

There is deliberately **no recency inside the stored score**: the phone already blends it in
(`FeedRanking.recencyWeight = 0.35`, half-life 3 days), and keeping quality separate means a
label collected today is still valid against the same paper next week.

**journal_tier** = `clamp( log2(1 + citedness_2y) / log2(21), 0, 1 )`, so a journal whose
papers average 1 citation in two years scores 0.23, 3 → 0.46, 10 → 0.79, 20 or more → 1.0.
Unknown journal (no ISSN match in OpenAlex) → 0.15, deliberately below "known but modest".
Log scale so *Nature* does not drown everything: the difference between an average and a
good journal matters more than the difference between good and superb.

**study_type**, from PubMed publication types, taking the highest that applies:

| Types | Value | Why |
|---|---|---|
| Meta-Analysis, Systematic Review, Practice Guideline, Consensus Statement | 1.00 | The evidence hierarchy; these are the ones a clinician-scientist must not miss |
| Randomized Controlled Trial | 0.90 | |
| Clinical Trial (any phase), Multicenter Study | 0.70 | |
| Review (narrative) | 0.60 | Reviews are high-value for a student; a researcher lens (P2) may lower this |
| Journal Article with no other type (**includes every not-yet-indexed paper**) | 0.50 | Neutral by construction: we do not know |
| Comparative Study, Observational Study, Evaluation Study | 0.50 | |
| Case Reports | 0.10 | |
| Editorial, Comment, Letter, News, Biography | 0.05 | |
| Published Erratum, Retraction of Publication, Retracted Publication | excluded | never shown |

**topic_match**: 1.0 if any of the topic's terms appears in the title; 0.6 if only in the
abstract; 0.2 if in neither (it matched only through PubMed's synonym expansion). **In P0 there
is no abstract** (esummary does not return one), so this is title-or-0.4 until `efetch` lands
in P1; with `[tiab]` queries the 0.2 case should not occur and the term stays as a guard.

**recency** (phone side, already built) = `0.5 ^ (age_days / 3)`, age measured from
`published`. The feed route should send `first_seen_at` as `published` whenever PubMed only
gave a month or a year (`datePrecision != "day"`), otherwise a "2026 Sep" paper looks three
weeks old on the day it appears.

**penalties**: −0.5 if `raw.lang` is not English; −0.3 if the title contains "erratum",
"corrigendum", "retraction", "reply to", "author response", "comment on".

**What the widget shows.** The top 3 by `shown` within the 7-day window. One rule I recommend
adding to `FeedRanking.rank`: **at least one of the three must be from the last 48 hours**
(the best-scoring recent one). With the built weights a week-old paper of quality 0.9 still
beats a same-day paper of quality 0.4 (0.66 vs 0.61), so a strong Monday paper can sit on the
lock screen all week and the widget looks dead. Every entry shows the paper's age ("2d") so a
stale widget is honest rather than wrong.

**The seam.** `ranker_version` is stored with every score (added in `0003`), the function is
pure, and the feed route asks for `rank` through one interface (`Ranker = (candidates, topic, ctx) => Scored[]`).
Version `h2` (add author h-index from the OpenAlex second pass), `p1` (per-user boost/mute
words), and `m1` (a model that reads the abstract) all plug into the same slot and can be
scored against the same labels before any of them touches the widget.

### 4.4 Honest prediction of how good `h1` will be

Say this plainly so nobody is surprised in a month:

- **Good at:** removing case reports, letters, errata, non-English, and off-topic drug papers;
  surfacing the systematic review in *Brain Stimulation* and the RCT in *Lancet Neurology*.
  Expect it to reliably beat "newest 5".
- **Mediocre at:** everything else, which is most weeks. On a week with no RCT and no
  meta-analysis, `h1` degrades to "most recent paper in the highest-ranked journal", which is
  a journal-prestige filter. It will miss the clever methods paper in a mid-tier journal every
  single time, because nothing in week-1 metadata says "clever".
- **Cannot do:** tell that a paper is *about the thing you specifically care about*
  ("closed-loop DBS for tremor" versus "spinal cord stimulation for pain", both
  "neuromodulation"). Only reader feedback or a model that reads abstracts can do that.

A truly *personal* filter needs one of three things, all deferred and all costed in section 5:
reader-supplied words (P1, $0), author reputation via OpenAlex's second pass (P1, $0), or a
model reading the abstract against the reader's own interests (P2: on-device Apple Foundation
Models on iOS 26 are $0; a server embedding model is $0 but tight on Vercel CPU; an LLM API
is the only paid path and stays opt-in).

### 4.5 How we will know it is good: the evaluation

Nothing in section 4.3 is trusted until it is measured. Three measurements, in order of
importance.

**E1. Kalp's hand labels (the ground truth that matters).**

- `/label/neuromodulation` on the website shows 100 papers from the last 30 days (field-tagged
  query), **in random order, with no score, journal-first so it feels like real skimming**,
  and two buttons: **Would read** / **Skip**. About 20 to 30 minutes of his time. Stored in
  `sift.labels`. Repeat for a second topic he genuinely follows (Q1 asks which).
- The eval script (`npm run eval -- --topic neuromodulation --ranker h1`) then replays: for
  each of the four weeks in the window it takes the ranker's top 5 and reports
  **precision@5** = how many of the five he marked "would read", averaged over weeks. It
  prints the same number for two baselines: **recency** (the five newest, i.e. what a PubMed
  alert shows first) and **random**. It also prints the **base rate** (what fraction of all 100
  he marked "read"), because if that is 40 % the bar is high and if it is 8 % it is low.
- **Pass:** p@5 ≥ 0.6 **and** ≥ 2x the recency baseline. **Fail:** p@5 within one paper of
  recency. Fail means stop building UI and go back to the ranker (section 5, P0 stop rule).
- **Ablation:** the script re-runs with each signal's weight set to zero. A signal whose removal
  does not move p@5 is dropped from `h2`; this is how we find out whether journal tier is
  carrying everything (I expect it is).
- Also reported: NDCG@5 (a ranking metric that rewards putting the best ones first), for the
  case study page; not a pass/fail gate.

**E2. Retrospective backtest against citations (free, large, no human time).**

Take papers added 10 to 12 months ago for the same query (about 300 a month), score them with
`h1` **using only fields that existed in their first week** (journal, title, abstract; pretend
publication types are unknown for the "publisher" fraction to avoid cheating), and compare with
their OpenAlex citation count *today*. Report: Spearman correlation, and what fraction of the
top-10 %-cited papers landed in the ranker's top 10 %. Caveats stated on the results page:
citations are a lagging, journal-correlated proxy for "important", so journal tier will look
better here than it deserves; treat E2 as a sanity check and a way to compare `h1` vs `h2`,
never as the pass/fail gate.

**E3. Real behaviour (P1 onward, sparse).** Taps are the only real engagement signal a widget
has (`widget-constraints.md`: there is no "was it seen" event). Fire `paper_opened` to
PostHog with topic, rank position and `ranker_version`. With one user this is anecdote, not
data; it becomes useful only if a handful of lab-mates use it (Q6).

**What "good" would look like on the case-study page:** a small table, one row per ranker
version, columns p@5 / recency baseline / random baseline / base rate / n labels / date. If the
first row says `h1: 0.55 vs recency 0.25 vs random 0.15 (base rate 0.15, n = 100)`, that is a
real result and an honest portfolio story: "a free heuristic doubled the hit rate of a PubMed
alert, and here is the ablation showing it was mostly the journal tier."

---

## 5. Phases

### P0 — prove the loop and measure it (target: one working week of evenings)

**Ships**

1. Done tonight by other agents: migration `0002` applied (section 3.1), `lib/pubmed.ts`
   (esearch + esummary with a rate-limit queue and recorded fixtures), the iOS shell. Left:
   migration `0003` (section 3.2) via runbook "Add a schema to Supabase Project B" step 2,
   then runbook "Regenerate Supabase types".
2. `lib/openalex.ts` (journal by ISSN, cached in `sift.journals`), `lib/ranking.ts` (`h1`,
   pure, unit-tested on the recorded corpus plus hand-made cases: an unindexed paper, a case
   report, an erratum, a non-English paper), `scripts/seed-topics.ts`.
3. Seeded topics with **field-tagged** queries (section 4.1), starting with the three Kalp
   named and the two the STATUS.md draft adds (DBS, neural engineering); Q1 decides which
   two he labels.
4. `GET /api/feed/<topic>` with lazy refresh (stale after 6 h) and `GET /t/<topic>` (the list,
   with the breakdown on hover/expand). `/api/health` unchanged (platform contract).
5. `/label/<topic>` behind `SIFT_ADMIN_TOKEN` (a `?key=` query string is enough for one user),
   writing to `sift.labels`; `npm run eval` printing the E1 table.
6. iOS, simulator only: the app fetches `/api/feed/<topic>` (hard-coded topic in P0) in
   `FeedModel.publishToWidget()`, saves to `SharedStore`, reloads the widget; the existing
   `FeedCodableTests` pin the wire format, so the route's JSON must match `Feed.swift`
   exactly; add the "one from the last 48 h" rule to `FeedRanking` with a test.
7. **Deploy 1** when the feed route works locally; **Deploy 2** after the label page and eval.
   Attach `sift.kalpkan.com` (runbook "Attach a domain to a Vercel project"), add the
   UptimeRobot monitor (runbook "Add an UptimeRobot monitor"), the `projects.json` entry
   (runbook "Add a project to `projects.json`") and the `settings-map.md` rows. That is the
   session's two-deploy budget; anything else waits.

**Proves**: the whole loop (PubMed → rank → store → widget → tap → paper) works, and E1 gives
the first honest number.

**Ruthlessly not in P0**: sign-in, per-user subscriptions, push notifications, a daily cron,
abstracts via `efetch`, per-user boost words, a large-widget layout, a settings screen in the
app beyond "open paper", Android, preprints, more than three topics.

**Stop and rethink if**: (a) E1 fails (p@5 within one paper of the recency baseline after one
weight-tuning pass) — then P1 becomes ranker-only work and no more UI is built until it passes;
(b) the `[tiab]` query still returns more than about 30 % off-topic papers on Kalp's labelling
pass — then query construction (synonyms, exclusions) comes before any scoring; (c) Kalp does
not do the labelling within two weeks — a product whose one user will not spend 25 minutes
grading it is telling you something.

### P1 — make it personal and make it self-running

**Ships**

1. Reader words: per topic, "boost" and "mute" word lists (`sift.topic_terms`, or per-user in
   `subscriptions` once auth exists). `h2` adds `+0.15 * boost_hits − 0.4 * mute_hit`.
2. OpenAlex second pass: 3 to 10 days after a paper appears, look it up by DOI; if found, add
   last-author h-index (`clamp(log2(1+h)/log2(65),0,1)`, weight taken from journal tier's
   0.35 → 0.25 / 0.10 split) and re-score. Evaluated as `h2` against the same labels first.
3. Daily Vercel cron (`vercel.json`, once a day, the Hobby maximum; `CRON_SECRET` as promptflip
   does) that refreshes every topic so the widget never triggers a slow lazy fetch, plus the
   90-day abstract cleanup.
4. Sign-in with the platform's shared Google auth (Project B `auth.users`; per-app
   `sift.profiles` per house rule 1 in `architecture.md`) so a user has subscriptions; labels
   become per user under RLS (`labeler = auth.uid()`).
5. `efetch` for abstracts (`papers.abstract`), which unlocks the abstract half of
   `topic_match` and everything in P2.
6. PostHog `paper_opened`, `topic_followed`, `label_given` (runbook "Add PostHog to an app").

**Proves**: that reader-supplied words move p@5 (they should, sharply, for one reader), and
that the system runs for 30 days without anyone touching it (UptimeRobot green, a row in
`refresh_runs` every day).

**Stop and rethink if**: `h2`'s author signal does not beat `h1` on E1 (then drop it, it is
complexity for nothing); or Kalp himself stops glancing at the widget after three weeks
(tracked by his own honesty, not by a metric — see E3). If the one person it was built for
stops looking, no lab-mate will start.

### P2 — the smarter ranker, and (maybe) the App Store

**Ships**, in whichever order the P1 data argues for:

1. **On-device reading.** iOS 26's Foundation Models framework (Apple's on-device model, free,
   runs in the simulator on an Apple-silicon Mac) scores each of the day's ~15 candidates
   against a one-paragraph "what I care about" the user wrote. Runs in the app, writes back a
   personal re-ranking. $0, private, and it is the first thing that can tell "closed-loop DBS"
   from "spinal cord stimulation for pain". **Risk:** a 3 B-parameter model's judgement of
   research importance is unproven; it goes through E1 like everything else.
2. **Server embeddings** (`@huggingface/transformers` with a ~23 MB MiniLM model in the Vercel
   function): similarity between each abstract and the reader's "would read" labels. Cheap
   (about 100 abstracts in well under a minute of CPU a day against 4 CPU-hours a month), but
   the 250 MB function bundle limit and cold starts need a spike to confirm. `m1`.
3. **Opt-in paid LLM ranking** only if Kalp says so (Q4). Never default.
4. **App Store** = human checkpoint H1 ($99/year), then TestFlight for lab-mates, then review.
   First-party content in a widget is unremarkable to App Review; the risk is the name (Q8),
   not the concept.

**Stop and rethink if**: none of the three rankers beats `h2` by at least one paper in five on
E1. That would mean the metadata ceiling *is* the ceiling for a solo, $0 project, and the
honest product is "a well-filtered, glanceable PubMed alert" — which is still worth having,
and still a fine portfolio piece, but should be described as exactly that.

---

## 6. Risks, ranked

| # | Risk | Likelihood | Kill criterion (the honest one) |
|---|---|---|---|
| 1 | **The free filter is mediocre** and the widget shows forgettable papers | High. Section 4.4 predicts it will beat recency but not by a lot on quiet weeks | E1: `h1` and one tuning pass cannot reach p@5 ≥ 0.6 or 2x recency → stop UI work; if `h2` (words + authors) still fails → describe the product as a filtered alert, not a curator |
| 2 | **One-user product with no way to reach a second user** (no developer program, no TestFlight, no App Store) | Certain until H1 | If Kalp will not pay the $99 after P1 proves value to him, Sift stays a personal tool + case study; that is a legitimate outcome, not a failure, but say it |
| 3 | **Signals arrive late.** Half of week-1 papers have no publication type; OpenAlex lags by days; the freshest papers, the ones the widget most wants, are scored on journal + title alone | Certain | Mitigated by daily re-scoring and the neutral 0.5 default. Kill: if E1 shows the "publisher-status" papers in the top 5 are wrong twice as often as indexed ones, hold every paper 48 h before showing it (trades freshness for accuracy) |
| 4 | **Query false positives** (the 280 vs 88 finding) recur per topic in different forms | Medium | If a topic's labelling pass shows > 30 % off-topic, fix the query before touching weights |
| 5 | **Kalp stops looking at the widget** | Medium; every "daily glance" product dies this way | Three weeks of not tapping and not caring → stop. He is the test |
| 6 | **Shared Supabase blast radius** (500 MB, one project for every app) | Low with three topics; medium if topics multiply | The 90-day abstract cleanup; never more than ~10 broad topics without checking usage |
| 7 | **NCBI rate limits or blocking** if the feed is public and popular | Low (server-side caching, 3 req/s, polite `tool`/`email`) | Free API key (Q5) raises it to 10/s; hard cap topics-per-day if it ever matters |
| 8 | **Simulator-only development hides device realities** (real refresh budget, lock-screen rendering, background fetch behaviour) | Certain until H1 | Nothing to do but note it; the JSON-fetch design is the most conservative option available |
| 9 | **The name "Sift"** collides with existing products (Sift Science, several "Sift" apps) | Medium for App Store, low for a subdomain | Q8; rename before H1, never after |
| 10 | App Review rejects the widget | Very low: first-party content, no ads (`why-not-ads.md`) | n/a |

---

## 7. Open questions for Kalp

Only you can answer these; the plan makes a default guess where it had to.

- **Q1. Which two fields do you actually want on your own lock screen?** The plan seeds
  `neuromodulation`, `bci` and `sca` as examples. E1 needs labels in a field you genuinely
  follow, and your review manuscript is *neuromodulation in SCA* — is the real topic that
  intersection (which had 3 to 4 papers a week, where ranking barely matters), or the broad
  field?
- **Q2. What does "important" mean to you?** Three lenses give different weights: the
  *clinician* (evidence hierarchy: meta-analyses and RCTs on top), the *student* (reviews on
  top), the *researcher* (primary methods papers on top, reviews down). `h1` is a clinician-
  leaning blend. Your labels will reveal your lens; saying it up front saves a tuning round.
- **Q3. Public or private?** Should `sift.kalpkan.com/t/neuromodulation` be a public,
  showcase-style page (the plan assumes yes: public read, it is the case study), or should the
  feed be private to signed-in users?
- **Q4. LLM spend, ever?** The plan keeps every ranker at $0 and treats a paid model as opt-in
  only. Is there any monthly amount (even $2) you would consider, or is $0 a hard line?
- **Q5. Will you create a free NCBI account** for an API key? Not required; it raises the
  PubMed limit from 3 to 10 requests a second and is good etiquette. Two minutes at
  ncbi.nlm.nih.gov/account.
- **Q6. Are there two or three lab-mates who would label 100 papers and run the widget?**
  E1 with one labeller proves it works *for you*; three labellers prove it works at all.
- **Q7. Preprints?** PubMed has essentially none (1 of 1,265). Adding bioRxiv/medRxiv via
  Europe PMC (free) is a P1-sized job; for BCI it matters, for clinical neuromodulation less.
- **Q8. The name.** "Sift" is taken by several products. Fine as a subdomain; a problem the
  day it goes on the App Store. Rename now or accept it?
- **H1 (human checkpoint). The $99/year Apple Developer Program.** Not needed for P0 or most
  of P1. It unlocks: a real device, the lock-screen widget in real conditions, App Groups,
  TestFlight for lab-mates, the App Store. The plan does not assume it.

---

## Appendix: the measurements

All run 2026-09-21 without an API key; re-run before trusting any number in this document.

```bash
# Volume with and without field tagging (esearch, last 7 days by Entrez date)
curl -s 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=neuromodulation&retmax=0&retmode=json&datetype=edat&reldate=7'          # count: 280
curl -s 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=neuromodulation%5Btiab%5D&retmax=0&retmode=json&datetype=edat&reldate=7' # count: 88

# Publication types over 30 days: append AND Review[pt], Systematic Review[pt], Meta-Analysis[pt],
# Randomized Controlled Trial[pt], Case Reports[pt], preprint[pt] → 300 / 35 / 26 / 64 / 46 / 1 of 1265

# Indexing status of week-1 papers: efetch 60 PMIDs as XML and count MedlineCitation Status
# → MEDLINE 34, Publisher 17, other 9; 59/60 had an abstract

# OpenAlex: works with the word in title/abstract, last 7 days → 82 (PubMed: 280); cited_by_count > 0 → 0
curl -s 'https://api.openalex.org/works?filter=title_and_abstract.search:neuromodulation,from_publication_date:2026-09-14,cited_by_count:>0&per-page=1'
# OpenAlex journal metrics by name (by ISSN in production): Brain Stimulation 2yr_mean_citedness ≈ 2.03, h_index 152
curl -s 'https://api.openalex.org/sources?search=Brain%20Stimulation&per-page=1&select=display_name,summary_stats'
```
