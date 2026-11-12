-- 0003_sift_radar.sql
--
-- Kalp's private research radar (docs/spec.md, "Scope revision, 2026-11-12";
-- docs/plan.md section 8). Five tables, all in the `sift` schema:
--
--   profiles   who may use the private API at all (one owner row: Kalp)
--   follows    which topics feed his radar
--   ratings    his thumbs up / down, with what he was shown when he tapped
--   opens      papers he opened, from the web, the app or the widget
--   interests  interest terms (from Obsidian, from taps, or typed by hand)
--
-- SECURITY MODEL, which is the opposite of 0002's on purpose:
--   0002's tables are public content read only through the service role, so
--   they have RLS with NO policies. These rows are PERSONAL. They have RLS
--   keyed on auth.uid(), with policies granted to `authenticated` only. There
--   is no policy for `anon`, so the public anon key reads zero rows here.
--
--   Every user_id references the SHARED auth.users of Project B (house rule 4:
--   one Google sign-in across Kalp's apps). Signing in to Project B does NOT
--   make anyone a Sift user: only a sift.profiles row does, and profiles has a
--   SELECT policy and nothing else, so no signed-in user can write their own
--   profile and promote themselves. The owner row is created server-side with
--   the service role, and only for an email in SIFT_OWNER_EMAILS.
--
--   The four data tables are additionally owner-gated (the `exists` clause), so
--   a stranger who signs in to the shared project through another app cannot
--   park rows in Sift's tables either. `(select auth.uid())` is the form the
--   Supabase linter recommends: it is evaluated once per statement, not per row.
--
-- RE-RUNNABLE: every `create policy` is preceded by `drop policy if exists`
-- (scripts/check-migrations.sh enforces it), and every table and index uses
-- `if not exists`, so applying this file twice is a no-op.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists sift.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

alter table sift.profiles enable row level security;

drop policy if exists profiles_select_own on sift.profiles;
create policy profiles_select_own on sift.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table if not exists sift.follows (
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic_id   uuid not null references sift.topics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

alter table sift.follows enable row level security;

create index if not exists follows_topic_id_idx on sift.follows (topic_id);

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------
-- One row per (user, paper): a re-tap updates it. Each row records what the
-- reader was SHOWN when they tapped (the rank, what newest-first would have
-- ranked it, and which ranker ranked it), so `npm run eval` can compare rankers
-- on real judgements. Known bias, printed by the eval: only shown papers get
-- rated.
create table if not exists sift.ratings (
  user_id        uuid not null references auth.users (id) on delete cascade,
  pmid           text not null references sift.papers (pmid) on delete cascade,
  topic_id       uuid references sift.topics (id) on delete set null,
  verdict        smallint not null check (verdict in (-1, 1)),
  shown_rank     integer not null check (shown_rank > 0),
  recency_rank   integer not null check (recency_rank > 0),
  ranker_version text not null,
  surface        text not null check (surface in ('web', 'ios', 'widget')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, pmid)
);

alter table sift.ratings enable row level security;

create index if not exists ratings_pmid_idx on sift.ratings (pmid);
create index if not exists ratings_topic_id_idx on sift.ratings (topic_id);

-- ---------------------------------------------------------------------------
-- opens
-- ---------------------------------------------------------------------------
-- An append-only log. A widget can never prove it was seen, so a tap that
-- opens a paper is the only engagement signal that is real.
create table if not exists sift.opens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  pmid       text not null references sift.papers (pmid) on delete cascade,
  surface    text not null check (surface in ('web', 'ios', 'widget')),
  created_at timestamptz not null default now()
);

alter table sift.opens enable row level security;

create index if not exists opens_user_id_idx on sift.opens (user_id, created_at desc);
create index if not exists opens_pmid_idx on sift.opens (pmid);

-- ---------------------------------------------------------------------------
-- interests
-- ---------------------------------------------------------------------------
-- Terms only, never note text (docs/obsidian-bridge.md, rule 2). Keyed by
-- source as well as term, so the Obsidian bridge can replace its own rows
-- without touching weights learned from taps or typed by hand. A negative
-- weight is a mute.
create table if not exists sift.interests (
  user_id    uuid not null references auth.users (id) on delete cascade,
  term       text not null check (term = lower(term) and length(term) between 1 and 64),
  weight     real not null check (weight between -1 and 1),
  source     text not null check (source in ('obsidian', 'taps', 'manual')),
  updated_at timestamptz not null default now(),
  primary key (user_id, term, source)
);

alter table sift.interests enable row level security;

-- ---------------------------------------------------------------------------
-- Policies for the four data tables: own rows only, and only for an owner.
-- ---------------------------------------------------------------------------
drop policy if exists follows_select_own on sift.follows;
create policy follows_select_own on sift.follows for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists follows_insert_own on sift.follows;
create policy follows_insert_own on sift.follows for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists follows_update_own on sift.follows;
create policy follows_update_own on sift.follows for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()));
drop policy if exists follows_delete_own on sift.follows;
create policy follows_delete_own on sift.follows for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));

drop policy if exists ratings_select_own on sift.ratings;
create policy ratings_select_own on sift.ratings for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists ratings_insert_own on sift.ratings;
create policy ratings_insert_own on sift.ratings for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists ratings_update_own on sift.ratings;
create policy ratings_update_own on sift.ratings for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()));
drop policy if exists ratings_delete_own on sift.ratings;
create policy ratings_delete_own on sift.ratings for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));

drop policy if exists opens_select_own on sift.opens;
create policy opens_select_own on sift.opens for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists opens_insert_own on sift.opens;
create policy opens_insert_own on sift.opens for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists opens_update_own on sift.opens;
create policy opens_update_own on sift.opens for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()));
drop policy if exists opens_delete_own on sift.opens;
create policy opens_delete_own on sift.opens for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));

drop policy if exists interests_select_own on sift.interests;
create policy interests_select_own on sift.interests for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists interests_insert_own on sift.interests;
create policy interests_insert_own on sift.interests for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
drop policy if exists interests_update_own on sift.interests;
create policy interests_update_own on sift.interests for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()));
drop policy if exists interests_delete_own on sift.interests;
create policy interests_delete_own on sift.interests for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from sift.profiles p where p.user_id = (select auth.uid())));
