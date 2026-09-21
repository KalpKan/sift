import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const raw = files.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n").toLowerCase();
/** The SQL with `--` comments stripped, so prose about money never trips a check on column types. */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/**
 * The four tables the AdSpace loop needs, and the two it needs to pay people.
 * `impressions` is the load-bearing one: a row is created when the widget is
 * handed a creative, and only *confirmed* (a non-null `confirmed_at`) when the
 * person deliberately taps through to the app. Nothing is ever billed or paid
 * on an unconfirmed row — that distinction is the whole product.
 */
const TABLES = ["advertisers", "creatives", "devices", "impressions", "ledger_entries", "payouts"] as const;

describe("adspace schema", () => {
  it("creates every table in the adspace schema, never in public", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`create table if not exists adspace.${t}`);
    }
    expect(sql).not.toMatch(/\bpublic\./);
  });

  it("enables row level security on every table", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`alter table adspace.${t} enable row level security`);
    }
  });

  it("grants no policy to anon or authenticated, so only the server (service_role) can read", () => {
    // Deny-by-default: an RLS-enabled table with no permissive policy returns
    // zero rows to anon. If a policy is ever added for anon, this test should
    // be updated deliberately, not silently.
    expect(sql).not.toMatch(/create policy[\s\S]{0,200}?to anon/);
    expect(sql).not.toMatch(/create policy[\s\S]{0,200}?to authenticated/);
  });

  it("indexes every foreign key column", () => {
    for (const idx of [
      "creatives_advertiser_id_idx",
      "impressions_creative_id_idx",
      "impressions_device_id_idx",
      "ledger_entries_device_id_idx",
      "ledger_entries_impression_id_idx",
      "payouts_device_id_idx",
    ]) {
      expect(sql).toContain(idx);
    }
  });

  it("makes a nonce single-use: unique, and one ledger accrual per impression", () => {
    expect(sql).toMatch(/nonce\s+text\s+not null\s+unique/);
    expect(sql).toContain("ledger_entries_impression_id_key");
  });

  it("stores money only as whole cents in integer columns, never floats", () => {
    expect(sql).not.toMatch(/\b(numeric|decimal|float|real|double precision|money)\b/);
    for (const col of ["payout_cents", "price_cents", "amount_cents"]) {
      expect(sql).toMatch(new RegExp(`${col}\\s+integer`));
    }
  });

  it("ships the two views the dashboard and the ledger read", () => {
    expect(sql).toContain("create or replace view adspace.creative_stats");
    expect(sql).toContain("create or replace view adspace.device_balances");
  });
});
