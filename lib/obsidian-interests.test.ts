/**
 * The Obsidian bridge against a fixture vault (tests/fixtures/vault). The
 * privacy contract (docs/obsidian-bridge.md) is the spec: every fixture word
 * containing "secret" sits somewhere the bridge must not read, so the first
 * thing each test checks is that none of them leak.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  BROAD_TAGS,
  EXCLUDED_FOLDERS,
  GENERIC_TAGS,
  buildInterests,
  formatDryRun,
  hasPrivateTag,
  isCourseCode,
  isExcludedPath,
  obsidianWeight,
  parseTags,
  planPush,
  readVault,
  suggestTopics,
} from "../scripts/obsidian-interests.mjs";
import { TOPICS } from "../scripts/seed-topics.mjs";

const VAULT = path.resolve(__dirname, "..", "tests", "fixtures", "vault");
const SCRIPT = path.resolve(__dirname, "..", "scripts", "obsidian-interests.mjs");

const noSecrets = (s: string) => expect(s.toLowerCase()).not.toMatch(/secret/);

describe("parseTags", () => {
  it("reads the wikilinks on the Tags: line, lower-cased, aliases dropped", () => {
    expect(parseTags("Status: x\nTags: [[Research]] [[BCI]] [[lumen|lumen alias]]\n\nbody [[other]]")).toEqual([
      "research",
      "bci",
      "lumen",
    ]);
  });

  it("ignores hashtags and wikilinks in the body", () => {
    expect(parseTags("Tags: #research #bci\n\n[[research]]")).toEqual([]);
    expect(parseTags("No tags line here [[research]]")).toEqual([]);
  });
});

describe("isCourseCode", () => {
  it("drops course codes by shape (<letters> <4 digits>[letter]), with no real code listed", () => {
    for (const t of ["chem 1234", "abcdefghi 1234", "xy-1234b", "zz9999", "abcdefghijkl 4321a"]) expect(isCourseCode(t), t).toBe(true);
    for (const t of ["bci", "kin-7", "k2-ab", "chem 12", "a 1234", "spindle cells", "1234 chem"]) expect(isCourseCode(t), t).toBe(false);
  });
});

describe("hasPrivateTag", () => {
  it("finds [[private]] anywhere in a note, any case, so a stray tag fails closed", () => {
    expect(hasPrivateTag("Tags: [[research]]\n\nbody [[Private]] text")).toBe(true);
    expect(hasPrivateTag("Tags: [[research]] [[private]]")).toBe(true);
    expect(hasPrivateTag("Tags: [[research]]\n\nmy private thoughts, no link")).toBe(false);
    expect(hasPrivateTag("[[private|alias]]")).toBe(true);
  });
});

describe("isExcludedPath", () => {
  it("excludes the journal, inbox, rough notes, templates and dot folders, at any depth", () => {
    expect(EXCLUDED_FOLDERS).toEqual(expect.arrayContaining(["7 - Journal", "0 - Inbox", "1 - Rough Notes"]));
    expect(isExcludedPath("7 - Journal/2026-11-01.md")).toBe(true);
    expect(isExcludedPath("6 - Main Notes/7 - Journal/deep.md")).toBe(true);
    expect(isExcludedPath("0 - inbox/x.md")).toBe(true);
    expect(isExcludedPath(".obsidian/x.md")).toBe(true);
    expect(isExcludedPath("6 - Main Notes/note-a.md")).toBe(false);
  });
});

describe("readVault + buildInterests on the fixture vault", () => {
  const notes = readVault(VAULT);
  const built = buildInterests(notes);

  it("keeps only [[research]] notes with no [[private]] anywhere in them, outside excluded folders", () => {
    expect(built.notesRead).toBe(5);
  });

  it("counts a copied note (identical tag list) once", () => {
    expect(built.distinctNotes).toBe(4);
  });

  it("turns the kept notes' tags into terms, weighted by how many notes use them", () => {
    expect(built.terms).toEqual([
      { term: "bci", weight: 0.4, notes: 2 },
      { term: "glia", weight: 0.4, notes: 2 },
      { term: "zebrafish", weight: 0.4, notes: 2 },
      { term: "k2-ab", weight: 0.3, notes: 1 },
      { term: "kin-7", weight: 0.3, notes: 1 },
      { term: "lumen", weight: 0.3, notes: 1 },
      { term: "spindle cells", weight: 0.3, notes: 1 },
    ]);
  });

  it("drops the generic tags and the too-broad ones, and says which", () => {
    expect(GENERIC_TAGS).toEqual(expect.arrayContaining(["research", "question", "coursework", "private"]));
    expect(BROAD_TAGS).toContain("brain");
    expect(built.droppedGeneric).toEqual(["chem 1234", "coursework", "question", "research"]);
    expect(built.droppedBroad).toEqual(["brain"]);
  });

  it("leaks nothing from the journal, inbox, rough notes, private, hashtag-only, untagged or body-only notes", () => {
    noSecrets(JSON.stringify(built));
  });

  it("never carries a note title, body or file name", () => {
    const s = JSON.stringify(built);
    for (const leak of ["note-a", "note-b.md", "Main Notes", "Source Material", "Does glia mapping", "quote"]) {
      expect(s).not.toContain(leak);
    }
  });
});

describe("obsidianWeight", () => {
  it("starts at 0.3 and adds 0.1 per extra note, up to 0.6", () => {
    expect([1, 2, 3, 4, 9].map(obsidianWeight)).toEqual([0.3, 0.4, 0.5, 0.6, 0.6]);
  });
});

describe("suggestTopics", () => {
  it("suggests frequent terms that no topic covers, never creating anything", () => {
    const terms = buildInterests(readVault(VAULT)).terms;
    const out = suggestTopics(terms, TOPICS);
    // "bci" is covered by brain-computer-interfaces (its initials), so it is not suggested.
    expect(out).toEqual(["glia", "zebrafish"]);
  });
});

describe("planPush", () => {
  it("upserts the current terms and deletes only Obsidian terms that left the vault", () => {
    const plan = planPush(
      [{ term: "bci", weight: 0.4, notes: 2 }],
      [
        { term: "bci", source: "obsidian" },
        { term: "gone", source: "obsidian" },
        { term: "gone", source: "taps" },
        { term: "mine", source: "manual" },
      ],
    );
    expect(plan).toEqual({ upserts: [{ term: "bci", weight: 0.4, source: "obsidian" }], deletes: ["gone"] });
  });
});

describe("the script, end to end", () => {
  const env: NodeJS.ProcessEnv = { ...process.env, SIFT_VAULT_PATH: VAULT };
  delete env.NODE_OPTIONS;

  it("dry-runs by default: prints terms and weights, sends nothing, needs no credentials", () => {
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const r = spawnSync(process.execPath, [SCRIPT], { env, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("zebrafish");
    expect(r.stdout).toContain("0.40");
    expect(r.stdout).toMatch(/research notes read: 5 \(4 distinct/);
    expect(r.stdout).toMatch(/nothing sent/i);
    expect(r.stdout).toMatch(/suggested topics: glia, zebrafish/);
    noSecrets(r.stdout + r.stderr);
    for (const leak of ["note-a", "Main Notes", ".md"]) expect(r.stdout).not.toContain(leak);
  });

  it("refuses --push without the service-role key, and still leaks nothing", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--push"], {
      env: { ...env, SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "" },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--env-file=.env.local/);
    noSecrets(r.stdout + r.stderr);
  });

  it("fails clearly when the vault is missing", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { env: { ...env, SIFT_VAULT_PATH: "/nonexistent/vault" }, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/vault not found/i);
  });
});

describe("formatDryRun", () => {
  it("states the contract in its own output", () => {
    const out = formatDryRun(buildInterests(readVault(VAULT)), ["glia"]);
    expect(out).toMatch(/Only tag names/);
    expect(out).toMatch(/nothing sent/i);
  });
});

describe("defaultVault", () => {
  it("finds KK's Mind under any GoogleDrive-<account> folder, and null when there is none", async () => {
    const { mkdtempSync, mkdirSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { defaultVault } = await import("../scripts/obsidian-interests.mjs");
    const home = mkdtempSync(path.join(tmpdir(), "sift-home-"));
    expect(defaultVault(home)).toBeNull();
    const v = path.join(home, "Library", "CloudStorage", "GoogleDrive-someone@example.com", "My Drive", "Obsidian", "KK's Mind");
    mkdirSync(v, { recursive: true });
    expect(defaultVault(home)).toBe(v);
  });
});
