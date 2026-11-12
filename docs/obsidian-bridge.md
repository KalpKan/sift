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

`--push` upserts `source = 'obsidian'` rows into `sift.interests` for the owner and deletes
Obsidian-sourced terms that are no longer in the vault. Taps (`source = 'taps'`) and manual
terms are never touched by the bridge.

## Baseline, measured 2026-11-12 (read-only, tag names only)

7 notes carry `[[research]]`. Co-tags include `dbs`, `seeg`, `neurotrophins`, `trka`,
`p75-ntr`, `parkinsons`, `neurodegeneration`, `aging`, `mitochondria`, `gene therapy`.
