import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
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

describe("every migration (0003 rules)", () => {
  const all = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(path.join(dir, f), "utf8").toLowerCase().replace(/--.*$/gm, ""))
    .join("\n");

  it("enables row level security on every table it creates", () => {
    const tables = [...all.matchAll(/create table if not exists (sift\.\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const t of tables) expect(all, t).toContain(`alter table ${t} enable row level security`);
  });

  it("never writes a policy for anon or public", () => {
    for (const p of all.match(/create policy[\s\S]*?;/g) ?? []) {
      expect(p.replace(/\s+/g, " "), p).toMatch(/ to authenticated /);
    }
  });
});

describe("scripts/check-migrations.sh", () => {
  const script = path.resolve(__dirname, "../scripts/check-migrations.sh");

  function run(files: Record<string, string>): { code: number; out: string } {
    const tmp = mkdtempSync(path.join(tmpdir(), "sift-mig-"));
    for (const [name, body] of Object.entries(files)) writeFileSync(path.join(tmp, name), body);
    const r = spawnSync("bash", [script], { env: { ...process.env, MIGRATIONS_DIR: tmp }, encoding: "utf8" });
    return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
  }

  it("passes the real migrations", () => {
    const r = spawnSync("bash", [script], { encoding: "utf8" });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  });

  it("fails a table without row level security", () => {
    const r = run({ "0001_x.sql": "create table if not exists sift.leaky (id int);" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/row level security.*sift\.leaky/);
  });

  it("fails a policy granted to anon", () => {
    const r = run({
      "0001_x.sql":
        "create table if not exists sift.t (id int);\nalter table sift.t enable row level security;\ncreate policy p on sift.t for select to anon using (true);",
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/policy/);
  });

  it("passes an authenticated, auth.uid()-keyed policy", () => {
    const r = run({
      "0001_x.sql":
        "create table if not exists sift.t (user_id uuid);\nalter table sift.t enable row level security;\ndrop policy if exists p on sift.t;\ncreate policy p on sift.t for select to authenticated\n  using (user_id = (select auth.uid()));",
    });
    expect(r.code, r.out).toBe(0);
  });
});

describe("policies are re-runnable", () => {
  const script = path.resolve(__dirname, "../scripts/check-migrations.sh");
  function run(sql: string) {
    const tmp = mkdtempSync(path.join(tmpdir(), "sift-mig-"));
    writeFileSync(path.join(tmp, "0001_x.sql"), sql);
    const r = spawnSync("bash", [script], { env: { ...process.env, MIGRATIONS_DIR: tmp }, encoding: "utf8" });
    return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
  }
  const table = "create table if not exists sift.t (user_id uuid);\nalter table sift.t enable row level security;\n";
  const policy = "create policy p on sift.t for select to authenticated\n  using (user_id = (select auth.uid()));\n";

  it("check-migrations fails a create policy without a preceding drop policy if exists", () => {
    const r = run(table + policy);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/drop policy if exists p on sift\.t/);
  });

  it("check-migrations passes when every create policy is preceded by its drop", () => {
    const r = run(table + "drop policy if exists p on sift.t;\n" + policy);
    expect(r.code, r.out).toBe(0);
  });

  it("every create policy in the real migrations has its drop policy if exists", () => {
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(path.join(dir, f), "utf8").toLowerCase())
      .join("\n");
    for (const m of all.matchAll(/create policy (\w+) on (sift\.\w+)/g)) {
      expect(all, m[0]).toContain(`drop policy if exists ${m[1]} on ${m[2]};`);
    }
  });
});
