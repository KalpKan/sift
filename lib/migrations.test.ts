import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "../supabase/migrations");
const first = readFileSync(path.join(dir, "0001_create_schema.sql"), "utf8").toLowerCase();

describe("supabase/migrations/0001_create_schema.sql", () => {
  it("creates the placeholder schema and grants usage to the three API roles", () => {
    expect(first).toContain("create schema if not exists sift;");
    expect(first).toContain("grant usage on schema sift to anon, authenticated, service_role;");
  });

  it("sets default privileges for tables, sequences and functions", () => {
    for (const kind of ["tables", "sequences", "functions"]) {
      expect(first).toContain(
        `alter default privileges in schema sift grant all on ${kind} to anon, authenticated, service_role;`,
      );
    }
  });

  it("ships a select-1 health function the /api/health route can call", () => {
    expect(first).toContain("create or replace function sift.health_select_one()");
    expect(first).toContain("grant execute on function sift.health_select_one() to anon, authenticated, service_role;");
  });

  it("explains the 'expose schema in Data API settings' step", () => {
    expect(first).toMatch(/exposed schemas/);
  });
});

describe("every migration", () => {
  it("never touches the public schema (the shared project rule)", () => {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(path.join(dir, f), "utf8");
      expect(sql, f).not.toMatch(/\bpublic\./);
    }
  });
});
