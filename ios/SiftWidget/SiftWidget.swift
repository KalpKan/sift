import WidgetKit
import SwiftUI

// MARK: - Timeline

struct PapersEntry: TimelineEntry {
    let date: Date
    let feedName: String
    let papers: [Paper]
}

struct PapersProvider: TimelineProvider {

    /// A widget extension gets roughly 30 MB for its whole process, and the
    /// medium family shows three rows at most. Decoding and holding a 500-paper
    /// feed to render three lines is how that budget gets spent.
    static let maxPapers = 5

    /// The system grants a frequently-viewed widget only ~40-70 reloads a day,
    /// and rejects entries closer together than about five minutes. Half-hourly
    /// entries across a few hours stay well inside both limits while keeping the
    /// relative ages ("2h", "3h") honest between reloads.
    static let entryStride: TimeInterval = 30 * 60
    static let entryCount = 6

    func placeholder(in context: Context) -> PapersEntry {
        PapersEntry(date: .now, feedName: Feed.sample.name, papers: Array(Paper.samples.prefix(Self.maxPapers)))
    }

    func getSnapshot(in context: Context, completion: @escaping (PapersEntry) -> Void) {
        completion(currentEntry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PapersEntry>) -> Void) {
        // DO NOT ADD NETWORKING HERE. A widget extension is not continuously
        // running and the system renders an archived view rather than executing
        // this code at draw time, so a fetch here would land after the render.
        // The app fetches, writes SharedStore, then calls
        // WidgetCenter.reloadTimelines(ofKind:). This provider only reads.
        let now = Date.now
        let base = currentEntry(at: now)

        // The content is fixed until the app says otherwise; the later entries
        // exist only so the displayed age advances between reloads.
        let entries = (0..<Self.entryCount).map { step in
            PapersEntry(
                date: now.addingTimeInterval(Double(step) * Self.entryStride),
                feedName: base.feedName,
                papers: base.papers
            )
        }

        // .after rather than .atEnd: it states the refresh intent explicitly and
        // keeps the ask inside the daily budget even if entryCount changes.
        let next = now.addingTimeInterval(Double(Self.entryCount) * Self.entryStride)
        completion(Timeline(entries: entries, policy: .after(next)))
    }

    private func currentEntry(at date: Date) -> PapersEntry {
        let feed = SharedStore().loadFeedOrSample()
        let ranked = FeedRanking.rank(feed.papers, now: date).prefix(Self.maxPapers)
        return PapersEntry(date: date, feedName: feed.name, papers: Array(ranked))
    }
}

// MARK: - Shared type

/// Uppercase, letterspaced, muted: the journal masthead line. Weight and size
/// carry the hierarchy, never colour, because the Lock Screen desaturates
/// everything (Accented and Vibrant rendering modes) and a colour-coded cue
/// would simply vanish there.
private struct JournalLine: View {
    let journal: String
    let age: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(journal)
                .textCase(.uppercase)
                .tracking(1.0)
                .lineLimit(1)
                .layoutPriority(1)
            Spacer(minLength: 4)
            Text(age)
                .monospacedDigit()
        }
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.secondary)
    }
}

// MARK: - Small

struct SmallPaperView: View {
    let entry: PapersEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let paper = entry.papers.first {
                JournalLine(
                    journal: paper.journal,
                    age: PaperFormatting.relativeAge(of: paper.published, now: entry.date)
                )
                // A hairline rule is the whole decoration budget: no card, no
                // gradient, no shadow. It is what a printed contents page uses.
                Divider().opacity(0.5)
                Text(PaperFormatting.truncatedTitle(paper.title, maxChars: 78))
                    .font(.system(.footnote, design: .serif))
                    .lineSpacing(0)
                    .minimumScaleFactor(0.85)
                    .widgetAccentable()
                Spacer(minLength: 0)
                Text(paper.authorsShort)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                EmptyFeedView(feedName: entry.feedName)
            }
        }
    }
}

// MARK: - Medium

struct MediumPaperView: View {
    let entry: PapersEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.feedName)
                .font(.system(size: 10, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(.secondary)
                .padding(.bottom, 6)

            if entry.papers.isEmpty {
                EmptyFeedView(feedName: entry.feedName)
            } else {
                // A fixed three: a widget cannot scroll, so showing a partial
                // fourth row would imply something that is not there.
                ForEach(Array(entry.papers.prefix(3).enumerated()), id: \.element.id) { index, paper in
                    if index > 0 { Divider().opacity(0.4).padding(.vertical, 5) }
                    MediumRow(paper: paper, now: entry.date, isLead: index == 0)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct MediumRow: View {
    let paper: Paper
    let now: Date
    let isLead: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(PaperFormatting.truncatedTitle(paper.title, maxChars: isLead ? 72 : 58))
                .font(.system(isLead ? .footnote : .caption, design: .serif))
                .lineLimit(2)
            HStack(spacing: 5) {
                Text(paper.journal)
                    .textCase(.uppercase)
                    .tracking(0.8)
                    .lineLimit(1)
                Text("·")
                Text(PaperFormatting.relativeAge(of: paper.published, now: now))
                    .monospacedDigit()
            }
            .font(.system(size: 9))
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Lock screen

/// accessoryRectangular is rendered desaturated and fits about three short
/// lines, so this is a strict weight-and-size hierarchy with no colour at all:
/// a light tracked masthead, the title in the strongest available weight, and
/// the age as a trailing detail on the same line as the journal.
struct RectangularPaperView: View {
    let entry: PapersEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let paper = entry.papers.first {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(paper.journal)
                        .textCase(.uppercase)
                        .tracking(0.9)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    Text(PaperFormatting.relativeAge(of: paper.published, now: entry.date))
                        .monospacedDigit()
                }
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(.secondary)

                // .widgetAccentable on the title alone: in Accented rendering
                // the title joins the accent group and everything else recedes,
                // which reproduces the same hierarchy the full-colour version
                // gets from weight.
                Text(PaperFormatting.truncatedTitle(paper.title, maxChars: 62))
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.9)
                    .widgetAccentable()
            } else {
                Text(entry.feedName)
                    .font(.system(size: 11))
                    .textCase(.uppercase)
                    .tracking(0.9)
                    .foregroundStyle(.secondary)
                Text("No papers yet")
                    .font(.system(size: 13, weight: .semibold))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Empty

private struct EmptyFeedView: View {
    let feedName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(feedName)
                .font(.system(size: 10, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(.secondary)
            Text("No papers yet")
                .font(.system(.footnote, design: .serif))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Widget

struct SiftPapersWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PapersEntry

    var body: some View {
        Group {
            switch family {
            case .systemMedium: MediumPaperView(entry: entry)
            case .accessoryRectangular: RectangularPaperView(entry: entry)
            default: SmallPaperView(entry: entry)
            }
        }
        // Whole-widget tap target opens the lead paper. The deep-link URL is
        // built from the same DeepLink helper the app parses with.
        .widgetURL(entry.papers.first.flatMap { DeepLink.url(forPaperID: $0.id) })
    }
}

struct SiftPapersWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: SiftWidgetKind.papers, provider: PapersProvider()) { entry in
            SiftPapersWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Latest papers")
        .description("The newest important papers in your field.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

@main
struct SiftWidgetBundle: WidgetBundle {
    var body: some Widget { SiftPapersWidget() }
}
