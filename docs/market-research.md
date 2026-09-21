# Market research — the ad widget, and Sift

**Written 2026-09-21.** Two verdicts in one document, because the second only exists as a
consequence of the first.

> **A note on method.** Both verdicts are sourced from primary material gathered on
> 2026-09-21. The ad-widget verdict (§1) rests on platform policy text, SEC filings and
> thirteen years of shipped products. The Sift verdict (§2) rests on an App Store sweep
> (~700 apps), direct API calls, the Wayback Machine, and the bibliometrics and
> media-effects literature. §2.2 is measured by this session directly and is re-runnable.
> §2.8 lists what could **not** be verified — nothing in this document is filled in from
> plausible-sounding inference.

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

## 2. Sift: **Buildable and legal. Not viable as a product.**

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

### 2.3 The competitive picture — **verified, and it is bad**

A dedicated agent swept the US App Store (~700 unique apps, 36 query terms, full-text search
of listings), plus direct API calls to iTunes Search, Google Play, OpenAlex, Crossref, arXiv,
NCBI and HN Algolia, and the Wayback Machine, on 2026-09-21. Three findings, in order of how
much they should change your mind.

**1. The exact product already exists, twice, and nobody uses it.**

| App | What it is | Widget | Price | Ratings | On store since |
|---|---|---|---|---|---|
| **AI Sentinel: Frontier** | Daily ranked arXiv feed with a four-axis importance score *with stated reasoning*, keyword alerts, Home Screen widget | Yes | $2.99/mo, $19.99/yr | **0** | Jul 2026 |
| **MediPub** | PubMed feed, followed-journal alerts, "Trending research at a glance" widget | Yes | up to $34.99/yr | **17** | Jul 2023 |

AI Sentinel is, feature for feature, the thing described in this repository — including the
scored feed with visible reasons. It launched two months ago and has **zero ratings**. MediPub
has **seventeen ratings in three years**.
[AI Sentinel](https://apps.apple.com/us/app/ai-sentinel-frontier/id6786108973) ·
[MediPub](https://apps.apple.com/us/app/medipub-research-on-pubmed/id6451085959)

Five research-paper widgets exist in total; the other three are citation-metric widgets with
0–2 ratings. **No established player has a widget** — not R Discovery (1M+ Play downloads),
not Read by QxMD (6,040 ratings), not Zotero, Paperpile or BrowZine. The wedge is open. But
the correct reading is not "nobody has done it, so there is an opening." It is: *people have
done it, and walked into an empty room.*

**2. The closest competitor had millions of users and shut down anyway.** Researcher App — the
mobile "browse new papers in your field" app — closed at the end of November 2024. Its own
notice: *"a thriving tool used by millions… It is with a heavy heart that we announce the
Researcher App will be closing."* The domain no longer resolves.
[Closure notice, archived](https://web.archive.org/web/20250912162156/https://www.researcher-app.com/)

**3. Researchers rank this exact mechanism 12th out of 14.** Ithaka S+R's US Faculty Survey
2021 (7,615 respondents) asked how faculty keep up with their field. The top three answers are
all *social*: conferences (67% rate highly important), papers suggested by other scholars
(62%), skimming key journals. *"Setting alerts for specific relevant keywords, authors, saved
searches"* — literally what Sift does — ranks **12th of 14**.
[DOI 10.18665/sr.316896](https://doi.org/10.18665/sr.316896)

### 2.4 Three more findings that undercut the premise

**Discovery is not the bottleneck; reading is.** Tenopir & King (2007) measured faculty at 21
articles/month, spending *"an average of 8 to 17 minutes per reading in identifying and
obtaining articles"* out of 34 minutes total. Finding papers is already only a quarter to a
third of the cost, and a widget does nothing about the other two thirds.
[DOI 10.1629/20199](https://doi.org/10.1629/20199)

**The phone is the wrong device, measured.** Nicholas et al. (2017), a three-year longitudinal
study of 116 early-career researchers across seven countries: *"Smartphones have become a
regularly used platform on which to perform quick and occasional searches for scholarly
information but are only rarely used for reading full text."*
[DOI 10.1002/leap.1087](https://doi.org/10.1002/leap.1087)

**Passive exposure does not teach, and may actively harm.** This is the evidence base for the
whole "be reminded of your field while glancing at your phone" premise, and it is negative.
A preregistered meta-analysis of **76 studies, N=442,136** found *"no evidence of any
political learning on social media in observational studies"*
([DOI 10.1093/joc/jqac034](https://doi.org/10.1093/joc/jqac034)) — the closest natural
experiment we have to a glanceable, algorithmically targeted feed in your interest area.
Worse, the "news-finds-me" effect: people who believe important information will reach them
passively *"are less likely to use traditional news sources and are less knowledgeable"*
([DOI 10.1111/jcc4.12185](https://doi.org/10.1111/jcc4.12185)). A widget whose promise is
"the important papers will find you" is a machine for inducing exactly that belief.

The positive glanceable-display evidence (Consolvo 2008, activity trackers) is all about
*self-referential metrics the viewer is already motivated to act on* — my steps, my rings —
not heterogeneous third-party content whose payoff requires a 34-minute read elsewhere.

### 2.5 A legal constraint we did not know about

**Abstracts are probably not ours to display, outside arXiv.** NLM: *"NLM does not claim the
copyright on the abstracts in PubMed; however, journal publishers or authors may."* Crossref:
third parties *"may only republish these abstracts with express permission of the copyright
holders."* OpenAlex — an organisation ideologically committed to open data — still refuses to
ship plaintext abstracts, serving an inverted index instead, *"due to legal constraints."*

**arXiv is the sole clean exception**: its metadata including the abstract is CC0, and its
Terms of Use explicitly bless *"a mobile app that notifies users about e-prints that might be
of interest to them."* [arXiv API TOU](https://info.arxiv.org/help/api/tou.html)

By luck, Sift is compliant today: `esummary` returns no abstracts, so we show titles,
journals and dates only. But the plan's P1 step "add abstracts via efetch" is now a legal
question, not just an engineering one. **Titles are clean everywhere; abstracts are clean only
on arXiv.**

Also newly relevant: **OpenAlex stopped being free at scale in 2026** — it is metered in
dollars (about 1,000 calls/day keyless, ~10,000 with a free key; paid tiers start at
$5,000/yr). Our journal-tier cache is well within the free allowance, but it is no longer the
unlimited resource the plan assumed.

### 2.6 Revised verdict

**Not viable as a product. Worth finishing as a portfolio project and a personal tool.**

The honest case against, now evidenced rather than suspected: the exact product exists and has
zero users; the closest competitor died with millions of users; researchers rank this
mechanism 12th of 14; discovery is a quarter of the cost of reading; the phone is documented
as a lookup device, not a reading one; passive exposure has no measured learning benefit and a
plausible harm; the incumbents are free because someone other than the reader funds them
(NLM, Ai2, Simons Foundation, WebMD); and in a narrow field the week's output is **8–16
papers**, which is not a firehose worth a product.

Note the squeeze, because it is the cleanest way to see the problem: **where the volume is
small enough for a widget to help, the filtering isn't worth paying for; where it is large
enough to hurt, a 1–3 item widget with no triage is the wrong shape.**

**The paying segment is shrinking, measurably.** Research Solutions (NASDAQ: RSSS), which
owns scite, reported FY2026 results on 2026-09-09: consumer/individual ARR **$6.34M, down
5.6% year on year** (down 7.5% in Q3), while its B2B line grew **+14.1%**. scite itself was
acquired for **$13.72M** with roughly **21,000 paying individuals** (SEC 8-K, 2023-11-27) —
about $650 per paying user, for a citation-analysis tool far more load-bearing than a feed.
Meanwhile institutions pay **$70,000–$1,000,000 per database per year** (Brundy & Thornton
2024, *JeSLIB* 13(2):e959, from FOI'd library contracts). **The money in this market is
institutional and it is moving further that way, not toward individuals.**

Competitor consumer pricing clusters at **$10–20/month with 40–50% academic discounts**, or
free for academics outright (ResearchRabbit free forever; Zeta Alpha free for academics). Both
existing widget competitors price *below* that cluster — $20–35/year — and still have 0 and 17
ratings. And the AI-native entrants needed capital, not subscriptions, to exist: Elicit took
$30M+, Consensus $45M. Meta.org, free and funded by the Chan Zuckerberg Initiative, was shut
down in 2022 anyway.

What survives is real but smaller than "a startup":

- **It is a genuinely good portfolio project.** A hand-written Xcode project, a WidgetKit
  extension, a real ranking function with an evaluation harness, a live API and a deployed
  site is a strong thing to show. That value does not depend on anyone downloading it.
- **It may be a good tool for Kalp specifically**, who reads this literature anyway.
- **The nothing-to-lose experiments below cost nothing and should happen before more code.**

### 2.7 The three experiments that should happen before any more building

1. **Demand test on yourself (week 1, ~3 hours, $0).** Turn on a PubMed My NCBI alert and a
   Google Scholar alert for your three fields, plus The Transmitter's neuroscience alerts.
   Log for 14 days: did you open it, did you click, did you read. *Kill if* your own open rate
   is under ~50% or you clicked through to fewer than three papers in two weeks — the problem
   you think you have is not the problem you have.
2. **Filter test (week 2, ~6 hours, $0).** Each week pick the two papers you think matter from
   the BCI and SCA output and email that two-item list to 15–20 people in your lab and
   department. *Kill if* fewer than a third engage twice running, or if your own picks feel
   arbitrary. This tests the only thing that could be the product — your judgement — with no
   code.
3. **Pre-mortem (30 minutes, $0).** Install AI Sentinel: Frontier and MediPub. Use them for a
   week. Write down why you stopped. That is Sift's obituary, available today for free.

If all three pass, the right next build is probably **not an app**: it is a free email list in
one narrow field where Kalp has genuine judgement, sourced from arXiv so abstracts can legally
be shown. A widget is then a retention feature for that list, not the product.

### 2.8 Still not verified

Reddit sentiment (Reddit blocks both scripted and fetch access — a real gap); revenue or ARR
for any indie academic tool; institutional spend on Scopus/Web of Science; newsletter
subscriber counts; and the "no widget" verdicts were established from App Store listing text
rather than by inspecting every screenshot.
