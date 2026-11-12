# The Obsidian bridge

*Written 2026-11-12.* Sift learns what Kalp is thinking about from his Obsidian vault,
"KK's Mind". This file is the contract for how, and it is binding on every agent that touches
the bridge: if a change would break a rule below, the change is wrong.

## The privacy contract

1. **Only `[[research]]`-tagged notes are read**, and never from `7 - Journal`, `0 - Inbox` or
   `1 - Rough Notes`, even if tagged. A `[[private]]` tag on a note excludes it outright.
2. **Only tag names leave the Mac.** No note bodies, titles, quotes or file names. Generic tags
   (`research`, `question`, `coursework`, course codes like `physpharm 4750`) are dropped.
3. **The bridge runs on Kalp's Mac only.** Vercel never sees the vault. The default mode is a
   dry run that prints exactly what would be sent. Pushing needs a separate flag.
4. **Interests and ratings are private rows.** RLS is keyed on `auth.uid()`, and the anon key
   reads nothing. Interests appear only on the signed-in settings page, where each one can be
   deleted.
5. **Public pages never personalise.** A test fails the build if `/` or `/t/<slug>` render
   anything from `sift.interests` or `sift.ratings`.

Kalp's own words, 2026-11-12: only things "tagged research"; "we do not want things I find
sensitive to be put out there".

## How the vault encodes tags

Tags are wikilinks on a `Tags:` line near the top of each note, e.g.
`Tags: [[research]] [[brain]] [[dbs]]`, never hashtags (see the vault's own convention).
A note with only `#research` hashtags is **not** treated as research-tagged.

Vault path: `/Users/kalp/Library/CloudStorage/GoogleDrive-masterofmath01@gmail.com/My Drive/Obsidian/KK's Mind`
(override with `SIFT_VAULT_PATH`).

## Running it

```bash
cd ~/projects/sift
env -u NODE_OPTIONS node scripts/obsidian-interests.mjs          # dry run: prints terms + weights, sends nothing
env -u NODE_OPTIONS node --env-file=.env.local scripts/obsidian-interests.mjs --push   # after reading the dry run
```

`env -u NODE_OPTIONS` is needed in the cmux terminal, whose `NODE_OPTIONS` points at a missing
file. The dry run also prints **suggested topics**: frequent terms with no matching Sift topic.
It never creates a topic.

`--push` upserts `source = 'obsidian'` rows into `sift.interests` for every owner row in
`sift.profiles` and deletes Obsidian-sourced terms that are no longer in the vault. Taps
(`source = 'taps'`) and manual terms are never touched by the bridge. It refuses to run before
the first sign-in (no owner row yet).

## How it decides (as built, 2026-11-12)

- **Which notes:** the first `Tags:` line within a note's first 30 lines must contain
  `[[research]]` (case-insensitive) and must not contain `[[private]]`. Wikilinks in the body and
  hashtags never count. Folders named `7 - Journal`, `0 - Inbox`, `1 - Rough Notes` and
  `5 - Template`, and any dot folder, are skipped at any depth. Only `.md` files are read.
- **What is kept from a note:** its tag names, nothing else. `readVault()` returns bare tag arrays;
  no path, title or body ever leaves that function.
- **Dropped:** generic tags (`research`, `question`, `coursework`, `private`, `idea`, `todo`),
  course codes (`physpharm 4750`), and tags too broad to rank on (`brain`, `biology`,
  `physiology`, `neuroscience`, `neurons`, `evolution`, `genetics`, `cell biology`, `science`,
  `medicine`, `therapeutics`, `clinical trials`). The dry run lists every dropped tag.
- **Copies count once:** two notes with an identical tag list (a source note and its main note)
  are one note.
- **Weight:** 0.3 for a tag on one research note, +0.1 per extra note, at most 0.6. In `p1` a
  weight of 1.0 is worth 40 ranking points, and all interest boosts on one paper cap at +40.
- **Suggested topics:** terms on at least two distinct research notes that no topic covers (by
  its words or its initials, so `dbs` is covered by Deep brain stimulation). Printed only.

## Where the output goes

The dry run prints to the terminal and nowhere else. Do not paste its term list into this repo:
`KalpKan/sift` is public, and the terms are meant to reach only Kalp's private `sift.interests`
rows (RLS, owner only), where `/me/settings` shows and deletes them.

## First real dry run, 2026-11-12 (counts only)

7 research notes read (5 distinct tag lists), 27 terms would be sent, 4 generic and 10 broad tags
dropped, 1 suggested topic. Not pushed: Kalp reads the dry run first (STATUS.md H7).

## Baseline, measured 2026-11-12 (read-only, tag names only)

7 notes carry `[[research]]`. Co-tags include `dbs`, `seeg`, `neurotrophins`, `trka`,
`p75-ntr`, `parkinsons`, `neurodegeneration`, `aging`, `mitochondria`, `gene therapy`.
