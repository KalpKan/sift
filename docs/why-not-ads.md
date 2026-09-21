# Why this is not an ad widget

Sift began on 2026-09-21 as "AdSpace": a phone widget that shows ads and pays you a
little for seeing them. Research that night killed it. Keeping the reasons here so nobody
(including a future agent) re-proposes it.

## It is prohibited, not merely weak

| # | Rule | Exact words | Source |
|---|---|---|---|
| 1 | Apple bans display ads in widgets | "Display advertising should be limited to your main app binary, and should not be included in extensions, App Clips, widgets, notifications, keyboards, watchOS apps, etc." | App Store Review Guidelines §2.5.18, developer.apple.com/app-store/review/guidelines/ (accessed 2026-09-21) |
| 2 | Google Play bans ads outside the serving app, **naming this exact product** | "Ads may only be displayed inside of the app serving them and must not interfere with other apps, ads, or the operation of the device... **This includes overlays, companion functionality, and widgetized ad units.**" | Google Play Ads / Disruptive Ads policy, support.google.com/googleplay/android-developer/answer/9857753 (accessed 2026-09-21) |
| 2b | Apple bans ads in *extensions* too, independently of 2.5.18 (a widget is an app extension) | "...and the extensions may not include marketing, advertising, or in-app purchases." | App Store Review Guidelines §4.4 (updated 2026-06-08) |
| 2c | Apple bans inflating impressions and ad-first apps | "Artificially increasing the number of impressions or click-throughs of ads, as well as apps that are designed predominantly for the display of ads." | App Store Review Guidelines §3.2.2(iii) |
| 3 | AdMob bans monetising pay-to-view apps at all | "Google ads may not be placed on apps that promise payment or incentives to users who click on or view ads." | AdMob behavioural policies, support.google.com/admob/answer/2753860 (accessed 2026-09-21) |
| 4 | Google Play bans monetising the lock screen | "Unless the exclusive purpose of the app is that of a lockscreen, apps may not introduce ads or features that monetize the locked display of a device." | Same Google Play Ads policy page |

Technically it is also dead before policy is even reached:

- **No ad SDK can render in a widget on either OS.** iOS widgets render a *pre-archived*
  SwiftUI snapshot — "the system can't run your code or update data bindings at the time it
  renders your widget" — so there is no live view hierarchy for an SDK to draw into. Android
  widgets are `RemoteViews`, whose supported-view list is a closed whitelist that excludes
  `WebView` and states "Descendants of these classes are not supported."
- **Neither OS will tell you a widget was seen.** There is no impression, visibility or
  on-screen callback anywhere in WidgetKit, and `AppWidgetProvider` has none either. The
  product's core promise — "every time you see the ad you get paid" — is unmeasurable by
  construction.
- **A widget render would not count as a viewable impression anyway.** The MRC mobile standard
  requires the pixels be in "a fully downloaded, opened, initialized application." A home
  screen is not that.

## The money was never there either

Thirteen years of attempts all land on the same number: **a person's passive phone attention
is worth about $1–5 a month**, and it has not risen.

- **Locket** (2013) paid $0.01/unlock capped at 3/hour — a ceiling of $0.03/hour. Stopped
  paying users in January 2014, about six months after launch.
- **Slidejoy** raised $1.2M; TechCrunch's *funding announcement* (2015-04-06) said users earn
  "up to $6 per month" and that "many seem to be earning less." Acquired by Buzzvil 2017,
  wound down; the closure notice blames "the lack of digital advertisements and offers in your
  country" — demand-side fill, not user supply, was the binding constraint.
- **Mode Mobile** is the only one at scale and files audited Reg A reports (SEC CIK 1748441).
  FY2025: $22.2M revenue, **net loss $5.9M**, and the segment table shows the actual earn app
  losing **$4.49M** while an ordinary utility app (Applock) earned +$4.06M. Audited
  user-redemption cost was **$938,228** against a claimed 50M+ lifetime users.
- **Glance** (InMobi) is the largest lock-screen ad platform on earth — ~450M users, Google-backed
  — and it **pays users nothing** and still lost roughly $120M in FY23.

No survivor in this category survived by paying users to see ads. Buzzvil became a B2B SDK,
Perk sold itself for its ad inventory, Glance dropped the payout, Nielsen/Comscore sell panel
measurement, and Brave's payout is a garnish on a browser people already want.

## What we kept

The engineering, not the business: the hand-written Xcode project recipe (app + WidgetKit
extension + unit tests, building headlessly via `xcodebuild`), the repo scaffold, and the
Supabase Project B wiring. See `docs/RESUME.md`.
