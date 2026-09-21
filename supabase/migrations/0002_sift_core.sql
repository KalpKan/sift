-- 0002_sift_core.sql
--
-- Sift's four tables. Everything lives in the `sift` schema (0001 created it);
-- nothing here may reference the shared schema, and scripts/check-migrations.sh
-- fails the build if it ever does.
--
-- THE SHAPE OF THE PROBLEM, which is why these tables look the way they do:
-- a single naive PubMed query (`neuromodulation`, last 7 days) returned 280
-- papers. Fetching is free and PubMed's own email alerts already do it. The
-- product is the filter. So the interesting column in this whole migration is
-- `topic_papers.score`, and the interesting table is the join that carries it.
--
-- Security model: RLS is ON for every table and there are NO POLICIES. That is
-- deliberate and it is the whole access-control story. An RLS-enabled table
-- with no permissive policy returns zero rows to `anon` and `authenticated`,
-- so the browser-side anon key (which is public, and is still used by
-- /api/health) can read nothing here. Every read and write in this app goes
-- through the server with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Adding a policy would silently open these tables to the public internet, so
-- lib/schema.test.ts asserts that none exists.

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
-- A PRODUCT DECISION, not a limitation: topics are CURATED by Kalp and seeded
-- from scripts/seed-topics.ts. There is no "type your own topic" box, and that
-- is the point.
--
-- A user typing "brain computer interface" into a search box gets PubMed's
-- automatic term mapping, which expands loosely and pulls in everything that
-- mentions the words. A hand-tuned query using MeSH headings, field tags and
-- explicit exclusions is dramatically more precise, and precision is the
-- entire product. Compare:
--     naive:      brain computer interface                    (very noisy)
--     hand-tuned: "brain computer interfaces"[MeSH Terms] OR
--                 ("brain-computer interface*"[Title/Abstract] ...)
-- One person tuning five queries beats ten thousand people typing one each.
-- `source` exists so a second free source (arXiv has no API key either, and
-- q-bio.NC carries BCI/neural-engineering work months before PubMed does) is a
-- new row and a new client module, not a migration. v1 fetches PubMed only.
create table if not exists sift.topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  -- The real, hand-tuned query string sent to the source verbatim.
  pubmed_query text not null,
  description  text,
  source       text not null default 'pubmed' check (source in ('pubmed', 'arxiv')),
  -- 'clinical' or 'engineering', and it changes how the ranker behaves. This
  -- is not a cosmetic label: MeSH publication types are a CLINICAL-EVIDENCE
  -- vocabulary (RCT, meta-analysis, case report) with no category for "we
  -- built a thing and measured it". A 53-paper sample across Kalp's own
  -- fields found 60% of papers carry no usable publication type at all, and
  -- almost all of those were in brain-computer interfaces. So lib/ranking.ts
  -- trusts publication type heavily for clinical topics and lightly for
  -- engineering ones, where it leans on journal, human-subject and scale cues
  -- instead. See docs/eval/README.md.
  kind         text not null default 'clinical' check (kind in ('clinical', 'engineering')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table sift.topics enable row level security;

-- GET /api/topics is `where is_active order by name`. Partial, because the
-- inactive rows are the ones we never want to scan.
create index if not exists topics_is_active_idx on sift.topics (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- papers
-- ---------------------------------------------------------------------------
-- Keyed by PMID because PubMed has already done the deduplication for us, and
-- because the same paper legitimately appears under several topics. A paper is
-- stored once; its relevance to a topic lives in topic_papers.
--
-- `raw` keeps the original esummary object. It costs almost nothing at this
-- volume and it means a better ranker can be back-filled over papers already
-- collected, without re-hitting NCBI for a corpus we already have.
create table if not exists sift.papers (
  pmid          text primary key,
  title         text not null,
  journal       text,
  authors       text[],
  doi           text,
  url           text,
  -- A date, not a timestamp: PubMed's `pubdate` is frequently only a month or
  -- a year ("2026 Sep", "2026"). lib/pubmed.ts normalises those to the first
  -- of the period rather than inventing a precision that is not in the source.
  published_on  date,
  pub_types     text[],
  -- When SIFT first saw it, which is what "new to you" actually means. It is
  -- not the same as published_on and the feed shows both.
  first_seen_at timestamptz not null default now(),
  raw           jsonb
);

alter table sift.papers enable row level security;

-- ---------------------------------------------------------------------------
-- topic_papers
-- ---------------------------------------------------------------------------
-- The product. `score` is lib/ranking.ts's verdict and `score_reasons` is the
-- human-readable justification the UI renders as tags — a ranker you cannot
-- interrogate is a ranker you cannot improve.
create table if not exists sift.topic_papers (
  topic_id      uuid not null references sift.topics (id) on delete cascade,
  pmid          text not null references sift.papers (pmid) on delete cascade,
  score         integer not null,
  score_reasons jsonb,
  ranked_at     timestamptz not null default now(),
  -- Composite key, so re-ranking a topic is an upsert and never duplicates.
  primary key (topic_id, pmid)
);

alter table sift.topic_papers enable row level security;

-- THE feed query: `where topic_id = $1 order by score desc limit $2`. This
-- index answers it without a sort, and its leading column also serves the
-- topic_id foreign key.
create index if not exists topic_papers_topic_id_score_idx
  on sift.topic_papers (topic_id, score desc);

-- The other foreign key. Needed so deleting a paper does not seq-scan.
create index if not exists topic_papers_pmid_idx on sift.topic_papers (pmid);

-- ---------------------------------------------------------------------------
-- refresh_runs
-- ---------------------------------------------------------------------------
-- An audit trail, because the failure mode of a feed is silence: a broken
-- fetch and a quiet week look identical from the outside. A run row is written
-- even when it fails, with the message in `error`.
create table if not exists sift.refresh_runs (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid references sift.topics (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  papers_seen  integer,
  papers_added integer,
  error        text
);

alter table sift.refresh_runs enable row level security;

create index if not exists refresh_runs_topic_id_idx on sift.refresh_runs (topic_id, started_at desc);
