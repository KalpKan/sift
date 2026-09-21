# What a WidgetKit widget can and cannot do

Verified against Apple's own documentation on 2026-09-21. Read this before designing anything
that lives in the widget — several of these rules are counter-intuitive and all of them are
load-bearing.

## The five that shape the product

**1. You get roughly 40–70 timeline refreshes a day, and you do not control when.**

> "For a widget the user frequently views, a daily budget typically includes from 40 to 70
> refreshes. This rate roughly translates to widget reloads every 15 to 60 minutes."
> — [Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)

Also: *"Your timeline provider should create timeline entries that are at least about 5 minutes
apart."* For Sift this is a non-issue and actually good news — new papers appear a few times a
day, not a few times a minute. Design for "a few fresh entries a day," never for real time.

**2. The widget cannot run code when it is displayed. It renders a pre-archived snapshot.**

> "your widget extension is not continually active, even if the widget is onscreen"
> "the system can't run your code or update data bindings at the time it renders your widget"

Consequences: no live data, no web view, no third-party SDK, and — importantly — **no way to
know the widget was ever looked at.** There is no impression, visibility or on-screen callback
anywhere in WidgetKit. (The OS *does* have that signal; it uses "the frequency and times the
widget is visible to the user" to size your refresh budget. It just never tells you.)

**3. Therefore: the app fetches, the widget only reads.**

The correct architecture, and the one Sift uses:

```
  main app (BGTaskScheduler, or a foreground launch)
      → fetches and ranks papers
      → writes JSON into the App Group container
      → WidgetCenter.shared.reloadTimelines(ofKind:)
                ↓
  widget TimelineProvider reads that file. It never touches the network.
```

Fetching inside `getTimeline` "works" but runs in a short-lived extension process with a tight
memory ceiling, and burns budget on a network round trip. Don't.

**4. Lock-screen widgets are monochrome or two-tone.**

`accessoryRectangular`, `accessoryCircular`, `accessoryInline`. On the Lock Screen these render
desaturated (Accented / Vibrant modes). **Colour can never carry meaning.** Hierarchy has to
come from size, weight and position. `.widgetAccentable()` marks what joins the accent group.
`accessoryRectangular` fits about two to three short lines — so on the Lock Screen, Sift shows
one paper: journal, title, age.

**5. Memory ceiling is about 30 MB for the whole extension process.**

Not documented by Apple; evidenced by `EXC_RESOURCE RESOURCE_TYPE_MEMORY (limit=30 MB)` crash
reports and Apple feedback FB8832751. Practical rule: the widget decodes at most a handful of
papers from the shared store, never the whole feed, and holds no images.

## Smaller rules worth knowing

| Thing | Rule |
|---|---|
| Remote images | Not possible. `AsyncImage` fails in a widget timeline. Bundle it or pre-download it to the shared container. Sift is typographic and loads none. |
| Interactivity | iOS 17+: `Button` and `Toggle` bound to an `AppIntent`, nothing else. A widget cannot scroll or page through items by itself. |
| Taps | `widgetURL(_:)` for a whole-widget tap, `Link` for individual rows (medium/large and Lock Screen). The app receives it in `onOpenURL`. |
| Budget exhausted | Nothing breaks; the widget keeps showing the last timeline entry. Design the stale state to look deliberate, not broken — show the age of the newest paper so a stale widget is honest rather than wrong. |
| Advertising | Banned outright. Guideline 2.5.18: display advertising "should not be included in extensions, App Clips, widgets, notifications, keyboards, watchOS apps, etc." See `why-not-ads.md`. |

## What this means for Sift specifically

- The refresh budget is comfortably more than we need. This is the rare case where the platform
  constraint and the product want the same thing.
- Because the widget cannot prove it was seen, **we will never know how often someone actually
  read a title.** Any "engagement" metric must come from taps, which are real events. Do not
  build analytics that pretend otherwise.
- The Lock Screen variant is the most valuable placement and the most constrained. Design it
  first, at two or three lines of desaturated text, and let the home-screen sizes be the
  generous version — not the other way round.
