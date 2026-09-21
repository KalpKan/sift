-- 0002_adspace_core.sql
--
-- The AdSpace loop, in six tables.
--
--   an advertiser ─ owns ─> creatives
--   a phone ─ is ─> a device
--   the widget shows a creative to a device      ─> an impression row (issued)
--   the person taps the widget and the app opens ─> that row is CONFIRMED
--   a confirmed row bills the advertiser and credits the person ─> a ledger entry
--   Kalp pays the balance out by hand                           ─> a payout row
--
-- The distinction between an *issued* and a *confirmed* impression is the
-- entire product. iOS gives a widget no way to prove it was looked at (see
-- docs/market-research.md, "Can a widget prove an impression?"), so AdSpace
-- never bills for a render. It bills for a deliberate tap-through, which the
-- device proves by returning a single-use nonce that was minted server-side.
--
-- ACCESS MODEL: every table has RLS on and NO policies, so `anon` and
-- `authenticated` read nothing at all. All reads and writes go through this
-- app's Next.js route handlers using the service-role key, which bypasses RLS.
-- The advertiser dashboard authenticates with a per-advertiser `dashboard_key`
-- compared server-side. Nothing in the iOS app or the browser ever holds a key
-- that can read this schema directly.
--
-- MONEY: only whole cents, only `integer`. No floats anywhere near a balance.

-- ---------------------------------------------------------------- advertisers

create table if not exists adspace.advertisers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 80),
  contact_email text not null check (position('@' in contact_email) > 1),
  -- The secret the advertiser puts into the dashboard to see their campaign.
  -- Minted by the operator; long and random. Never shown in any list view.
  dashboard_key text not null unique check (length(dashboard_key) >= 32),
  status        text not null default 'active' check (status in ('active', 'paused')),
  created_at    timestamptz not null default now()
);

alter table adspace.advertisers enable row level security;

-- ------------------------------------------------------------------ creatives

-- A creative is a tiny billboard: a headline, a line of body copy, a button.
-- The length limits are not cosmetic — the copy has to be legible in a
-- 158x158pt home-screen widget, so they are enforced in the database.
create table if not exists adspace.creatives (
  id            uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references adspace.advertisers (id) on delete cascade,
  headline      text not null check (length(trim(headline)) between 1 and 40),
  body          text check (length(body) <= 90),
  cta_label     text not null default 'See offer' check (length(cta_label) between 1 and 18),
  cta_url       text check (cta_url ~ '^https://'),
  accent_hex    text not null default '#1B7F5A' check (accent_hex ~ '^#[0-9a-fA-F]{6}$'),
  status        text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  -- What the advertiser is billed for one confirmed view, and what the person
  -- who confirmed it earns. Both are set per creative so a campaign can be
  -- priced without a schema change. price_cents >= payout_cents is the margin.
  price_cents   integer not null default 5 check (price_cents between 0 and 10000),
  payout_cents  integer not null default 1 check (payout_cents between 0 and 10000),
  -- Stop serving once this many confirmations happen in a UTC day. Null = no cap.
  daily_cap     integer check (daily_cap > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint creatives_margin_not_negative check (price_cents >= payout_cents)
);

alter table adspace.creatives enable row level security;

create index if not exists creatives_advertiser_id_idx on adspace.creatives (advertiser_id);
-- The widget's "what should I show next" query filters on status only.
create index if not exists creatives_active_idx on adspace.creatives (status) where status = 'active';

-- -------------------------------------------------------------------- devices

-- One row per app install. Deliberately anonymous: a random id the phone
-- generates on first launch, and nothing else. No name, no email, no ad id, no
-- IDFA — which is also why AdSpace never has to show an ATT prompt.
create table if not exists adspace.devices (
  id           uuid primary key default gen_random_uuid(),
  install_id   text not null unique check (length(install_id) between 16 and 64),
  platform     text not null check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table adspace.devices enable row level security;

-- ---------------------------------------------------------------- impressions

create table if not exists adspace.impressions (
  id           uuid primary key default gen_random_uuid(),
  creative_id  uuid not null references adspace.creatives (id) on delete cascade,
  device_id    uuid not null references adspace.devices (id) on delete cascade,
  -- Minted when the timeline is built, returned by the app when the person
  -- taps through. Single-use: `unique` is what stops a replayed tap paying twice.
  nonce        text not null unique check (length(nonce) >= 32),
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- Null until the person deliberately opened the app from the widget.
  -- Only a non-null value is ever billed or paid.
  confirmed_at timestamptz,
  constraint impressions_expires_after_issue check (expires_at > issued_at),
  constraint impressions_confirmed_before_expiry check (confirmed_at is null or confirmed_at <= expires_at)
);

alter table adspace.impressions enable row level security;

create index if not exists impressions_creative_id_idx on adspace.impressions (creative_id);
create index if not exists impressions_device_id_idx on adspace.impressions (device_id);
-- The daily-cap check and the dashboard both count confirmations by creative
-- and day; a partial index keeps that off the much larger unconfirmed rows.
create index if not exists impressions_confirmed_idx
  on adspace.impressions (creative_id, confirmed_at)
  where confirmed_at is not null;

-- ------------------------------------------------------------- ledger_entries

-- Append-only money. A balance is the sum of a device's entries, never a
-- column that something has to remember to update.
create table if not exists adspace.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null references adspace.devices (id) on delete cascade,
  -- Set for an accrual, null for a payout or a manual adjustment. Unique, so a
  -- confirmed impression can only ever credit someone once.
  impression_id uuid references adspace.impressions (id) on delete set null,
  -- Positive credits the person, negative debits them (a payout).
  amount_cents  integer not null,
  kind          text not null check (kind in ('accrual', 'payout', 'adjustment')),
  note          text check (length(note) <= 200),
  created_at    timestamptz not null default now(),
  constraint ledger_entries_impression_id_key unique (impression_id),
  constraint ledger_entries_accrual_is_positive check (kind <> 'accrual' or amount_cents > 0),
  constraint ledger_entries_payout_is_negative check (kind <> 'payout' or amount_cents < 0)
);

alter table adspace.ledger_entries enable row level security;

create index if not exists ledger_entries_device_id_idx on adspace.ledger_entries (device_id);
create index if not exists ledger_entries_impression_id_idx on adspace.ledger_entries (impression_id);

-- -------------------------------------------------------------------- payouts

-- A payout Kalp made by hand (Interac e-Transfer, a gift card). The matching
-- negative ledger entry is what actually moves the balance; this row is the
-- record of the real-world transfer.
create table if not exists adspace.payouts (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid not null references adspace.devices (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method       text not null check (method in ('interac', 'gift_card', 'other')),
  status       text not null default 'requested' check (status in ('requested', 'paid', 'cancelled')),
  requested_at timestamptz not null default now(),
  paid_at      timestamptz,
  note         text check (length(note) <= 200),
  constraint payouts_paid_has_date check (status <> 'paid' or paid_at is not null)
);

alter table adspace.payouts enable row level security;

create index if not exists payouts_device_id_idx on adspace.payouts (device_id);

-- ---------------------------------------------------------------------- views

-- What an advertiser sees on their dashboard. Counts issued vs confirmed side
-- by side on purpose: the gap between them is the honest measure of how much
-- of "shown" actually turns into "seen".
create or replace view adspace.creative_stats as
select
  c.id                                                            as creative_id,
  c.advertiser_id,
  c.headline,
  c.status,
  c.price_cents,
  c.payout_cents,
  count(i.id)                                                     as issued,
  count(i.confirmed_at)                                           as confirmed,
  coalesce(sum(case when i.confirmed_at is not null then c.price_cents else 0 end), 0)::integer
                                                                  as spend_cents,
  max(i.confirmed_at)                                             as last_confirmed_at
from adspace.creatives c
left join adspace.impressions i on i.creative_id = c.id
group by c.id;

-- What a person is owed. Positive cents.
create or replace view adspace.device_balances as
select
  d.id                                             as device_id,
  d.install_id,
  d.platform,
  coalesce(sum(l.amount_cents), 0)::integer        as balance_cents,
  coalesce(sum(l.amount_cents) filter (where l.kind = 'accrual'), 0)::integer
                                                   as lifetime_earned_cents,
  count(l.id) filter (where l.kind = 'accrual')    as confirmed_views,
  d.last_seen_at
from adspace.devices d
left join adspace.ledger_entries l on l.device_id = d.id
group by d.id;

-- Views run as their owner (postgres) unless told otherwise, which would leak
-- past the RLS above. `security_invoker` makes them obey the caller's policies,
-- so they are only readable by the service role, exactly like the tables.
alter view adspace.creative_stats set (security_invoker = true);
alter view adspace.device_balances set (security_invoker = true);
