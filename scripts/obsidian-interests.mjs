#!/usr/bin/env node
/**
 * THE OBSIDIAN BRIDGE. Reads Kalp's "KK's Mind" vault ON HIS MAC and turns the
 * tags of his [[research]] notes into interest terms for the radar.
 *
 * The contract is docs/obsidian-bridge.md and it is binding:
 *   1. Only notes whose Tags: line has [[research]] are read, never from
 *      7 - Journal, 0 - Inbox or 1 - Rough Notes (at any depth), and never a
 *      note with [[private]] ANYWHERE in it (fail closed: a private link in
 *      the body counts). Templates and dot folders are skipped too.
 *   2. Only tag names leave the Mac: no bodies, titles, quotes or file names.
 *      Generic tags (research, question, coursework, course codes) are dropped.
 *   3. Runs here only. The default is a dry run that prints exactly what would
 *      be sent and sends nothing. --push is a separate, explicit flag.
 *
 * Usage (on this Mac, `env -u NODE_OPTIONS` because cmux's preload is gone):
 *   env -u NODE_OPTIONS node scripts/obsidian-interests.mjs
 *   env -u NODE_OPTIONS node --env-file=.env.local scripts/obsidian-interests.mjs --push
 *
 * --push upserts source='obsidian' rows into sift.interests for every owner
 * in sift.profiles and deletes Obsidian terms no longer in the vault. Rows
 * learned from taps or typed by hand are never touched.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TOPICS } from "./seed-topics.mjs";

/**
 * The vault on Google Drive for desktop: ~/Library/CloudStorage/GoogleDrive-<account>/My Drive/
 * Obsidian/KK's Mind. Found by looking, so no account address is written into this public repo.
 */
export function defaultVault(home = os.homedir()) {
  const root = path.join(home, "Library", "CloudStorage");
  const rel = path.join("My Drive", "Obsidian", "KK's Mind");
  try {
    for (const d of readdirSync(root).filter((n) => n.startsWith("GoogleDrive-")).sort()) {
      const candidate = path.join(root, d, rel);
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // no CloudStorage folder: not this Mac
  }
  return null;
}

/** Never read, even if tagged [[research]] (contract rule 1), plus templates. */
export const EXCLUDED_FOLDERS = ["7 - Journal", "0 - Inbox", "1 - Rough Notes", "5 - Template"];

/** Say nothing about a subject (contract rule 2). `private` is here so it can never be sent. */
export const GENERIC_TAGS = ["research", "question", "coursework", "private", "idea", "todo"];

/**
 * Too broad to rank on: "brain" is in half of every BCI title. Not sensitive,
 * just useless as a boost, so they are dropped and listed in the dry run.
 */
export const BROAD_TAGS = [
  // whole disciplines and organs: a generic stoplist, not anyone's tag list
  "anatomy", "biochemistry", "biology", "brain", "cell biology", "chemistry", "ecology", "evolution", "genetics",
  "health", "immunology", "medicine", "neurons", "neuroscience", "pharmacology", "physics", "physiology",
  "psychology", "science",
  // kinds of study rather than subjects: they would lift every trial or every drug paper
  "clinical trials", "therapeutics",
];

/**
 * A course code tag, by SHAPE so no real course is ever listed in this public
 * file: 2-12 letters, an optional space or hyphen, 4 digits, an optional
 * letter ("chem 1234", "abcdefghi 1234", "xy-1234b").
 */
const COURSE_CODE = /^[a-z]{2,12}[\s-]?\d{4}[a-z]?$/;

export function isCourseCode(tag) {
  return COURSE_CODE.test(tag);
}

/** How far down a note its Tags: line may sit ("near the top"). */
const TAGS_WITHIN_LINES = 30;
/** sift.interests.term check: 1..64 characters. */
const MAX_TERM = 64;
/** A term must appear in this many research notes to be suggested as a topic. */
const SUGGEST_MIN_NOTES = 2;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The wikilinks on a note's `Tags:` line, lower-cased, `[[x|alias]]` -> `x`. Hashtags never count. */
export function parseTags(text) {
  const lines = text.split(/\r?\n/).slice(0, TAGS_WITHIN_LINES);
  const line = lines.find((l) => /^\s*tags\s*:/i.test(l));
  if (!line) return [];
  return [...line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
    .map((m) => m[1].trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** [[private]] (or [[private|alias]]) anywhere in the note, any case. */
export function hasPrivateTag(text) {
  return /\[\[\s*private\s*(\|[^\]]*)?\]\]/i.test(text);
}

export function isExcludedPath(relPath) {
  const parts = relPath.split(/[\\/]/).slice(0, -1);
  return parts.some(
    (p) => p.startsWith(".") || EXCLUDED_FOLDERS.some((x) => x.toLowerCase() === p.trim().toLowerCase()),
  );
}

/**
 * Every eligible note's tag list, and nothing else: no paths, no titles, no
 * bodies leave this function. Notes are returned as bare arrays of tags.
 */
export function readVault(vaultDir) {
  const notes = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue; // a Drive placeholder that is not on disk
      }
      if (st.isDirectory()) {
        if (!isExcludedPath(`${relPath}/x`)) walk(abs, relPath);
        continue;
      }
      if (!name.toLowerCase().endsWith(".md") || isExcludedPath(relPath)) continue;
      const text = readFileSync(abs, "utf8");
      if (hasPrivateTag(text)) continue;
      const tags = parseTags(text);
      if (!tags.includes("research")) continue;
      notes.push([...new Set(tags)]);
    }
  };
  walk(vaultDir, "");
  return notes;
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/** Hyphen and space spellings are one term ("spindle-cells" = "spindle cells"). */
const termKey = (t) => t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(" ");

/** 0.3 for one note, +0.1 per extra note, at most 0.6. */
export function obsidianWeight(notes) {
  return Math.round(Math.min(0.6, 0.3 + 0.1 * (notes - 1)) * 10) / 10;
}

export function buildInterests(rawNotes) {
  // A note copied into two folders (a source note and its main note, say) has
  // the same tag list twice; count it once, or every copy doubles its weight.
  const distinct = new Map(rawNotes.map((tags) => [[...tags].sort().join("\u0000"), tags]));
  const notes = [...distinct.values()];
  const generic = new Set();
  const broad = new Set();
  /** key -> { term (first spelling seen), notes } */
  const byKey = new Map();
  for (const tags of notes) {
    const inThisNote = new Set();
    for (const tag of tags) {
      if (GENERIC_TAGS.includes(tag) || isCourseCode(tag)) {
        generic.add(tag);
        continue;
      }
      if (BROAD_TAGS.includes(tag)) {
        broad.add(tag);
        continue;
      }
      const key = termKey(tag);
      if (!key || tag.length > MAX_TERM || inThisNote.has(key)) continue;
      inThisNote.add(key);
      const hit = byKey.get(key);
      if (hit) hit.notes += 1;
      else byKey.set(key, { term: tag, notes: 1 });
    }
  }
  const terms = [...byKey.values()]
    .map(({ term, notes: n }) => ({ term, weight: obsidianWeight(n), notes: n }))
    .sort((a, b) => b.notes - a.notes || a.term.localeCompare(b.term));
  return {
    notesRead: rawNotes.length,
    distinctNotes: notes.length,
    terms,
    droppedGeneric: [...generic].sort(),
    droppedBroad: [...broad].sort(),
  };
}

const singular = (w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(singular);

/** Does any topic already cover this term (its words, or its initials: "bci")? */
function covered(term, topics) {
  const want = words(term);
  return topics.some((t) => {
    const name = words(t.name);
    const text = new Set([...name, ...words(t.slug), ...words(t.pubmed_query ?? t.pubmedQuery ?? "")]);
    const initials = name.map((w) => w[0]).join("");
    return (want.length === 1 && want[0] === initials) || want.every((w) => text.has(w));
  });
}

/** Frequent terms with no matching topic. Printed only; the bridge never creates a topic. */
export function suggestTopics(terms, topics) {
  return terms
    .filter((t) => t.notes >= SUGGEST_MIN_NOTES && !covered(t.term, topics))
    .map((t) => t.term)
    .sort();
}

/** What --push will do, given the owner's current Obsidian rows. Taps and manual rows are never touched. */
export function planPush(terms, existing) {
  const now = new Set(terms.map((t) => t.term));
  return {
    upserts: terms.map((t) => ({ term: t.term, weight: t.weight, source: "obsidian" })),
    deletes: existing.filter((r) => r.source === "obsidian" && !now.has(r.term)).map((r) => r.term),
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export function formatDryRun(built, suggestions) {
  const width = Math.max(4, ...built.terms.map((t) => t.term.length));
  const rows = built.terms.map((t) => `  ${t.term.padEnd(width)}  ${t.weight.toFixed(2)}   ${t.notes}`);
  return [
    "Sift Obsidian bridge: DRY RUN",
    "Only tag names from [[research]] notes are listed below; no note bodies, titles or file names.",
    "",
    `research notes read: ${built.notesRead} (${built.distinctNotes} distinct; identical tag lists count once)`,
    "",
    `  ${"term".padEnd(width)}  weight  notes`,
    ...(rows.length ? rows : ["  (no terms)"]),
    "",
    `dropped as generic: ${built.droppedGeneric.join(", ") || "none"}`,
    `dropped as too broad: ${built.droppedBroad.join(", ") || "none"}`,
    `suggested topics: ${suggestions.join(", ") || "none"} (printed only; no topic is ever created)`,
    "",
    `would send ${built.terms.length} terms as source='obsidian'. Nothing sent.`,
    "To send them: env -u NODE_OPTIONS node --env-file=.env.local scripts/obsidian-interests.mjs --push",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function push(built) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.NEXT_PUBLIC_APP_SCHEMA || "sift";
  if (!url || !key) {
    console.error("--push needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: run with node --env-file=.env.local");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { db: { schema }, auth: { persistSession: false, autoRefreshToken: false } });

  const { data: owners, error: oErr } = await db.from("profiles").select("user_id").eq("role", "owner");
  if (oErr) throw new Error(oErr.message);
  if (!owners?.length) {
    console.error("No owner yet: sign in at https://sift.kalpkan.com/me first, then push.");
    process.exit(1);
  }

  for (const { user_id } of owners) {
    const { data: existing, error: eErr } = await db.from("interests").select("term, source").eq("user_id", user_id);
    if (eErr) throw new Error(eErr.message);
    const plan = planPush(built.terms, existing ?? []);
    const stamp = new Date().toISOString();
    if (plan.upserts.length) {
      const { error } = await db
        .from("interests")
        .upsert(plan.upserts.map((r) => ({ ...r, user_id, updated_at: stamp })), { onConflict: "user_id,term,source" });
      if (error) throw new Error(error.message);
    }
    if (plan.deletes.length) {
      const { error } = await db
        .from("interests")
        .delete()
        .eq("user_id", user_id)
        .eq("source", "obsidian")
        .in("term", plan.deletes);
      if (error) throw new Error(error.message);
    }
    console.log(`owner ${user_id.slice(0, 8)}…: upserted ${plan.upserts.length}, deleted ${plan.deletes.length} (${plan.deletes.join(", ") || "none"})`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const vault = process.env.SIFT_VAULT_PATH || defaultVault();
  if (!vault || !existsSync(vault)) {
    console.error(`vault not found: set SIFT_VAULT_PATH (looked in the default "KK's Mind" path)`);
    process.exit(1);
  }
  const built = buildInterests(readVault(vault));
  console.log(formatDryRun(built, suggestTopics(built.terms, TOPICS)));
  if (process.argv.includes("--push")) {
    console.log("\n--push: sending the terms above.");
    await push(built);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
