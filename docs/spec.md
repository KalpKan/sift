# Sift — MVP spec

**Written 2026-09-21.** `plan.md` is the long architecture and roadmap document; this is the
short one that says what v1 *is*, what it deliberately is not, and how we will know it worked.
Where the two disagree, this file wins for scope and `plan.md` wins for design detail.

---

## One paragraph

A researcher picks a field. A widget on their home screen and lock screen shows the two or
three papers from this week that are worth their time. Tapping one opens it. That is the whole
product. The hard part is not fetching papers — PubMed will email you those for free — it is
deciding which three of the week's eighty-eight matter, and everything in this spec exists to
make that decision, measure it, and improve it.

## The one number that decides whether this is worth continuing

Kalp labels 100 papers from one of his own fields as **"would read" / "skip"**, shown in
random order with no scores visible. The ranker is then scored against those labels.

- **Pass:** precision@5 ≥ 0.6, **and** at least 2× the precision of a plain
  newest-first feed (which is exactly what a PubMed email alert gives you, free).
- **Fail:** the ranker lands within one paper of newest-first. If that happens, **stop UI
  work.** Sift would be a nicer-looking version of something that already exists and is free.

This is the only acceptance criterion that matters. Everything else is plumbing.

## In scope for v1

| Piece | What it does |
|---|---|
| `sift` schema, Supabase Project B | `topics`, `papers`, `topic_papers`, `refresh_runs`. RLS on every table with **no policies** — the public key reads nothing, all access is server-side. |
| PubMed client | `esearch` + `esummary`, no API key, 3 req/s respected. Tolerant `pubdate` parsing (PubMed emits `2026 Sep 14`, `2026 Sep-Oct`, `2026 Winter`, bare years). Fixture-tested, no network in tests. |
| Ranking `h1` | Pure, deterministic, returns a score **and its reasons**. Free signals only: publication type, journal tier, topic match in the title, recency; penalties for errata, replies and non-English. |
| Feed API | `GET /api/feed?topic=<slug>` returns a small prepared JSON feed, refreshing from PubMed when the cache is older than six hours. |
| Web pages | `/` explains Sift and shows a live feed. `/t/<slug>` is the full ranked list with each paper's scoring reasons visible — this doubles as the debugging view and the portfolio case study. |
| iOS app | Lists the feed, opens papers, handles `sift://paper/<id>` deep links. |
| Widget | `systemSmall`, `systemMedium`, and the lock-screen `accessoryRectangular`. Reads from a shared container; never touches the network. |

## Deliberately not in v1

| Not doing | Why |
|---|---|
| User accounts, per-user topics | Topics are curated by Kalp. A hand-tuned PubMed query beats a user's free-text query badly, and there are no users yet. |
| An LLM anywhere | $0 constraint. The seam is there (`ranker_version`, a one-function interface) and the free on-device route on iOS 26 is the intended P2 path, not a paid API. |
| arXiv and preprints | PubMed carries essentially none (1 of 1,265 in 30 days). This is a real gap for brain–computer interfaces and a non-issue for clinical fields. The schema is source-agnostic so it is a new file, not a migration. |
| Abstracts | `esummary` does not return them; `efetch` does, and it is a P1 job. Until then topic-matching works on titles only. |
| Citation-based ranking | Measured: 0 of 82 papers from the last 7 days had a single citation. Citations are useful for *evaluating* the ranker retrospectively and useless for ranking it live. |
| Push notifications | A widget that is quietly right is better than a notification that is usually wrong. Revisit only if the ranker passes its gate. |
| App Store submission | Needs the $99 membership, and needs the ranker to pass first. |

## Two things that are true and inconvenient

**A widget cannot prove it was seen.** There is no impression or visibility callback anywhere
in WidgetKit, on purpose. Every engagement number Sift ever reports must come from taps, which
are real events. We will not build a metric that pretends otherwise.

**The heuristic is field-dependent.** Publication types are a *clinical evidence* vocabulary.
For neuromodulation they work well. For brain–computer interfaces, where the literature is
engineering, roughly 60% of papers carry no type at all — including, in a real sample, the two
most important papers of the fortnight (a 4096-channel intraoperative mapping paper and a
vision-restoration result). So an untagged paper must score **neutral, never penalised**, and
engineering topics have to lean on journal tier and human-subject cues instead. If the ranker
is going to fail anywhere, it will fail here first.

## Done means

1. `npm test`, `npm run lint`, `npm run build`, `bash scripts/check-migrations.sh` — all green.
2. `xcodebuild ... test` — green. *(Done: 49 tests, 0 failures, `SiftWidget.appex` embedded.)*
3. The feed API returns real ranked papers for at least two different fields.
4. The site is live on `sift.kalpkan.com` with `/api/health` and an UptimeRobot monitor.
5. The widget renders a real feed in the simulator.
6. `STATUS.md` and `docs/RESUME.md` are accurate enough for a cold start.
