# Market research — the ad widget, and Sift

**Written 2026-09-21.** Two verdicts in one document, because the second only exists as a
consequence of the first.

> **A note on completeness, up front.** The ad-widget verdict (§1) is thoroughly sourced:
> five research agents spent the night on it and every claim below carries a primary citation.
> The Sift verdict (§2) is **not** equally sourced. The session's web-search budget (200
> queries) was exhausted on the ad question before Sift's competitive landscape could be
> checked. What follows separates what was **measured**, what is **general knowledge**, and
> what is **not verified** — and §2.4 lists exactly what to check first next session. Nothing
> here is filled in from plausible-sounding inference.

---

## 1. The ad widget: **Not feasible.** Verdict is final.

Full evidence in [`why-not-ads.md`](./why-not-ads.md). The short version:

**It is prohibited, on three independent grounds.** Apple App Store Review Guideline 2.5.18
bans display advertising in widgets by name; Google Play's Disruptive Ads policy bans ads
outside the serving app and explicitly names "widgetized ad units"; AdMob bans placing ads in
any app that "promise[s] payment or incentives to users who click on or view ads." Any one of
these ends it.

**It is technically impossible before policy is even reached.** An iOS widget renders a
pre-archived SwiftUI snapshot — Apple: "the system can't run your code or update data bindings
at the time it renders your widget" — so no ad SDK can draw into it. Android widgets are
`RemoteViews`, whose supported-view list is closed and excludes `WebView`. And neither OS
exposes any impression or visibility callback, which means the product's core promise —
*you get paid every time you see the ad* — is **unmeasurable by construction**.

**The money was never there.** Thirteen years of attempts converge on the same number:

| Product | What a user actually got | Fate |
|---|---|---|
| Locket (2013) | $0.01/unlock, capped 3/hour | Stopped paying users ~6 months in |
| Slidejoy (2014–2020) | "Up to $6/month" was the *funding-announcement ceiling*; users reported $1–2 | Acquired, wound down |
| Mode Mobile (current) | $10 cashout ≈ 2–3 months of daily use | Alive; see below |
| Glance / InMobi | **nothing** — 450M users, pays users $0 | Alive, ~$120M FY23 loss |
| Nielsen / MobileXpression | ~$5/month | Alive — but sells *panel measurement*, not impressions |

Mode Mobile is the decisive case because it files audited Reg A reports (SEC CIK 1748441).
FY2025: $22.2M revenue, **net loss $5.9M**, and the segment table shows the actual earn-app
losing **$4.49M** while an ordinary utility app (Applock) earned +$4.06M. Audited user
redemptions were **$938,228** against a claimed 50M+ lifetime users. The business is sustained
by retail investors, not by advertising.

**The benchmark that reframes everything.** Prolific — a research panel — pays participants a
**$8/hour floor and $12/hour recommended**, and charges researchers 42.8% on top. That is
roughly **$0.20 per minute** of a specific person's attention. An ad impression is worth about
**$0.02**. Attention sold *retail to someone who needs that specific person* is worth an order
of magnitude more than attention sold *wholesale to an ad auction*. No survivor in this
category survived by paying users to see ads. Not one.

---

## 2. Sift: **Feasible to build. Unproven as a product.**

### 2.1 What changed, and it is the whole reason this is a different conversation

A widget showing **content from your own app** is ordinary and unremarkable — News, Stocks and
Sports widgets have shipped for years. Guideline 2.5.18 governs *display advertising*, not
content. So the single hard blocker that killed the ad idea **does not apply**, and it did not
merely soften: it vanished. That is a genuine, structural improvement, not a rationalisation.

### 2.2 What I measured myself tonight (these are real, re-runnable numbers)

Every figure here came from live PubMed and OpenAlex calls, no API key; the commands are in
`plan.md`'s appendix.

| Finding | Number | Why it matters |
|---|---|---|
| Raw weekly volume, `neuromodulation` | **280 papers / 7 days** | The firehose is real |
| Same, field-tagged `neuromodulation[tiab]` | **88 / 7 days** (3.2× less) | **Two-thirds of the "noise" was a bad query**, not a ranking problem. PubMed silently expands the bare term to the MeSH heading *neurotransmitter agents* and returns drug papers. |
| High-evidence tier (meta-analysis + systematic review + RCT) | **18 of 200** (9%) | A free filter cuts a week to ~2–3 papers/day — exactly widget-sized |
| Papers with **no** publication type | **32 of 53** across three fields | The clinical-evidence vocabulary does not cover engineering literature |
| Week-one papers not yet MEDLINE-indexed | **17 of 60** | Signals arrive late; untagged must score neutral and papers must be re-scored daily |
| Papers with ≥1 citation in their first 7 days | **0 of 82** | Citation counts are useless for ranking, usable only for retrospective evaluation |
| Spinocerebellar ataxia weekly volume | **3–4 papers** | In small fields there is nothing to filter; the honest widget shows everything |

**The most important negative result.** In brain–computer interfaces — Kalp's primary
interest — the two obviously landmark papers of the fortnight (a 4096-channel intraoperative
mapping paper, and a vision-restoration result in blind participants) both carry **no
publication type at all**, while incremental EEG-decoding papers carry none either. A
publication-type ranker cannot tell them apart. The heuristic that works well for clinical
neuromodulation is close to useless for BCI, which is the field that matters most here.

### 2.3 The competitive picture — **partially verified, read the labels**

**Verified structurally:** the incumbent is free email. PubMed's My NCBI saved-search alerts
and Google Scholar alerts already do the fetching part at no cost, and every researcher
already has them. *(General knowledge, widely known, not independently re-verified tonight.)*
Sift's entire claim to exist is that the **filtering** is better and the **surface** is one
people actually look at. If the filtering is not visibly better, Sift is a prettier version of
a free thing.

**Not verified — check these first next session:**

1. **Does any existing tool ship a real iOS home-screen or lock-screen widget for new papers?**
   This is *the* wedge question. If someone already does it well, the opening is much smaller.
   Check the App Store listings and screenshots for: Researcher App, Scholar Inbox,
   Semantic Scholar, ResearchRabbit, Litmaps, Paper Digest, Feedly, Inoreader.
2. Whether Researcher App is still maintained, and its download numbers.
3. Scholar Inbox's approach (it is a genuine personalised recommender and the closest
   intellectual competitor).
4. What individual academics actually pay for tools, and whether the buyer is the individual,
   the lab, or the library. My prior is that individuals pay almost nothing and the graveyard
   of academic tools is large — but that is a prior, not a finding.
5. Whether curated newsletters (Nature Briefing, The Transmitter) are the real substitute.

### 2.4 Honest verdict

**Build it, but treat it as unproven and hold it to a number.**

*For:* the legal blocker is gone; the data is free, legitimate and unlimited enough
(PubMed, arXiv, OpenAlex, Crossref all free, no key, licences permit display); the $0
constraint genuinely holds; Kalp is himself the target user, which is rarer and more valuable
than it sounds; and the technical risk is now zero because the app, widget and tests are
built and passing.

*Against:* the competitor is free and already installed. The free ranker is good at removing
junk and mediocre at finding importance — and specifically weakest in Kalp's main field.
"A widget" is a feature, not a company, and the monetisation question is entirely unexamined.

*The honest framing:* Sift is an **excellent portfolio project** and an **unproven product**.
Those are different bars and it currently clears the first, not the second.

**The one number that settles it.** Kalp labels 100 papers from his own field, blind, as
"would read" / "skip". The ranker must reach **precision@5 ≥ 0.6 and beat a plain
newest-first feed by 2×**. Newest-first *is* the free PubMed alert. If Sift lands within one
paper of it, it has no reason to exist and UI work should stop. If it clears the bar
comfortably, the filter is real and everything else is worth building.

Until that measurement exists, no one — including this document — knows whether Sift is good.
