# The evaluation set

`eval-set.csv` is 53 real PubMed papers from a 14-day window across three of Kalp's fields
(neuromodulation, brain-computer interfaces, spinocerebellar ataxia), captured 2026-09-21.

Columns: `topic, pmid, title, journal, date, pub_types, url, would_read`.

## What it is for

`lib/ranking.ts` is a hand-weighted heuristic. Its weights were chosen from two measured
publication-type distributions, which is better than vibes but is still not evidence that the
ranking is *good*. Nothing in the test suite can tell you whether the top three papers are the
three a researcher would actually have wanted, because that is a question about Kalp, not about
the code.

This file is how that question gets answered.

## What Kalp does

Open `eval-set.csv` and put `y` or `n` in the `would_read` column for each row — "would I have
been glad this appeared on my Lock Screen?" That is the only judgement needed; it takes about
ten minutes.

## What we do with it afterwards

Score the ranker against the labels, per topic:

- **precision@3** — of the three papers Sift would have shown for a topic, how many are `y`?
  This is the number that matters, because three is what the widget shows.
- **precision@10** — the same at the length of the web feed.
- **recall of the `y` set** — how many of the papers Kalp wanted did Sift surface at all? A
  ranker that buries a wanted paper at rank 40 is failing differently from one that shows three
  mediocre papers.

Run the same three numbers against a trivial baseline — **newest first, no ranking at all** —
because that is what a PubMed email alert already gives you for free. If Sift cannot beat
newest-first on precision@3, the ranker is not earning its place and the honest move is to say
so rather than to keep tuning weights.

## Known selection bias, stated up front

These 53 rows are what PubMed returned for three queries in one fortnight. They are not a random
sample of the literature, they over-represent whatever was published that week, and the
brain-computer-interfaces slice is dominated by offline EEG-decoding papers. Treat a good score
here as "did not obviously fail", not as "works".
