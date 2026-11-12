import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Migration 0003: Kalp's private radar (profiles, follows, ratings, opens,
 * interests). These rows are personal, so the security model is the opposite
 * of 0002's: RLS keyed on `auth.uid()`, policies granted to `authenticated`
 * only, never to `anon`, and `profiles` (which decides who is an owner) can be
 * read by its own user but never written by one.
 */
const file = path.resolve(__dirname, "..", "supabase", "migrations", "0003_sift_radar.sql");
const raw = readFileSync(file, "utf8").toLowerCase();
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const TABLES = ["profiles", "follows", "ratings", "opens", "interests"] as const;
const DATA_TABLES = ["follows", "ratings", "opens", "interests"] as const;

/** Every `create policy ... ;` statement, whitespace-collapsed. */
const policies = (sql.match(/create policy[\s\S]*?;/g) ?? []).map((p) => p.replace(/\s+/g, " "));

describe("sift radar schema (0003)", () => {
  it("creates all five tables in the sift schema", () => {
    for (const t of TABLES) expect(sql).toContain(`create table if not exists sift.${t}`);
    expect(sql).not.toMatch(/\bpublic\./);
  });

  it("enables row level security on every one", () => {
    for (const t of TABLES) expect(sql).toContain(`alter table sift.${t} enable row level security`);
  });

  it("ties every row to a user in the shared auth.users, cascading on delete", () => {
    expect(sql.match(/user_id\s+uuid\s+(primary key\s+)?(not null\s+)?references auth\.users\s*\(\s*id\s*\)\s*on delete cascade/g)?.length).toBe(5);
  });

  it("grants policies to authenticated only, never to anon or public", () => {
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p, p).toMatch(/ to authenticated /);
      expect(p, p).not.toMatch(/ to (anon|public)\b/);
      expect(p, p).toContain("auth.uid()");
    }
  });

  it("lets a user read their own profile row and nothing else: no self-insert, update or delete", () => {
    const onProfiles = policies.filter((p) => p.includes(" on sift.profiles "));
    expect(onProfiles).toHaveLength(1);
    expect(onProfiles[0]).toContain(" for select ");
    // A self-insert policy would let any Google account make itself an owner.
  });

  it("covers select, insert, update and delete on each data table, owner-gated", () => {
    for (const t of DATA_TABLES) {
      for (const op of ["select", "insert", "update", "delete"]) {
        const match = policies.filter((p) => p.includes(` on sift.${t} `) && p.includes(` for ${op} `));
        expect(match, `${t} ${op}`).toHaveLength(1);
        expect(match[0]).toMatch(/user_id = \(select auth\.uid\(\)\)/);
        // Only an owner (a sift.profiles row) may hold radar data, so a stranger
        // who signs in to the shared project cannot park rows here.
        expect(match[0]).toContain("sift.profiles");
      }
    }
  });

  it("allows only the owner role", () => {
    expect(sql).toMatch(/role\s+text\s+not null\s+default 'owner'\s+check \(role in \('owner'\)\)/);
  });

  it("keeps one rating per (user, paper), so a re-tap updates the row", () => {
    expect(sql).toMatch(/primary key\s*\(\s*user_id\s*,\s*pmid\s*\)/);
    expect(sql).toMatch(/verdict\s+smallint\s+not null\s+check \(verdict in \(-1, 1\)\)/);
  });

  it("records what was shown with each rating: ranks, ranker version, surface", () => {
    expect(sql).toMatch(/shown_rank\s+integer\s+not null/);
    expect(sql).toMatch(/recency_rank\s+integer\s+not null/);
    expect(sql).toMatch(/ranker_version\s+text\s+not null/);
    expect(sql.match(/surface\s+text\s+not null\s+check \(surface in \('web', 'ios', 'widget'\)\)/g)?.length).toBe(2);
  });

  it("keys interests by (user, term, source) and only allows the three sources", () => {
    expect(sql).toMatch(/primary key\s*\(\s*user_id\s*,\s*term\s*,\s*source\s*\)/);
    expect(sql).toMatch(/source\s+text\s+not null\s+check \(source in \('obsidian', 'taps', 'manual'\)\)/);
    expect(sql).toMatch(/weight\s+real\s+not null/);
  });

  it("follows are (user, topic) pairs that disappear with the topic", () => {
    expect(sql).toMatch(/primary key\s*\(\s*user_id\s*,\s*topic_id\s*\)/);
    expect(sql).toMatch(/topic_id\s+uuid\s+not null\s+references sift\.topics\s*\(\s*id\s*\)\s*on delete cascade/);
  });

  it("indexes the foreign keys the joins and cascades use", () => {
    for (const idx of ["follows_topic_id_idx", "ratings_pmid_idx", "ratings_topic_id_idx", "opens_user_id_idx", "opens_pmid_idx"]) {
      expect(sql).toContain(idx);
    }
  });
});
