import SwiftUI

/// A journal's table of contents, not a news feed: rules instead of cards, one
/// typographic hierarchy, no colour used to carry meaning.
struct FeedView: View {

    @StateObject private var model = FeedModel()
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    Section {
                        ForEach(model.rankedPapers()) { paper in
                            PaperRow(
                                paper: paper,
                                isHighlighted: model.highlightedPaperID == paper.id
                            )
                            .id(paper.id)
                            .contentShape(Rectangle())
                            .onTapGesture { open(paper) }
                            .listRowInsets(EdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20))
                        }
                    } header: {
                        FeedHeader(feed: model.feed)
                    }
                }
                .listStyle(.plain)
                .onChange(of: model.highlightedPaperID) { _, id in
                    guard let id else { return }
                    withAnimation(.easeInOut(duration: 0.3)) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                    // Fade the highlight out on its own. A widget tap is a
                    // "here it is" gesture, not a selection to be managed.
                    Task {
                        try? await Task.sleep(for: .seconds(2.5))
                        withAnimation(.easeOut(duration: 0.6)) { model.clearHighlight(id) }
                    }
                }
            }
            .navigationTitle("Sift")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onOpenURL { model.handleDeepLink($0) }
        .task { model.publishToWidget() }
    }

    private func open(_ paper: Paper) {
        guard let url = paper.url else { return }
        openURL(url)
    }
}

private struct FeedHeader: View {
    let feed: Feed

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(feed.name)
                .font(.system(.title2, design: .serif))
                .foregroundStyle(.primary)
            Text("Updated \(PaperFormatting.relativeAge(of: feed.updatedAt, now: .now)) ago")
                .font(.caption2)
                .textCase(.uppercase)
                .tracking(0.6)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .textCase(nil)
    }
}

private struct PaperRow: View {
    let paper: Paper
    let isHighlighted: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                JournalLabel(text: paper.journal)
                Spacer(minLength: 8)
                Text(PaperFormatting.relativeAge(of: paper.published, now: .now))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            Text(paper.title)
                .font(.system(.body, design: .serif))
                // Tight leading is what makes a multi-line title read as one
                // block rather than three separate lines.
                .lineSpacing(1)
                .foregroundStyle(.primary)

            Text(paper.authorsShort)
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let summary = paper.summary {
                Text(summary)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, isHighlighted ? 10 : 0)
        .padding(.vertical, isHighlighted ? 8 : 0)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.primary.opacity(isHighlighted ? 0.06 : 0))
        )
        .accessibilityElement(children: .combine)
    }
}

/// Tracked uppercase in a muted tone — the one place the design leans on
/// letterspacing, and it is what makes the list read as a journal masthead.
struct JournalLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2)
            .textCase(.uppercase)
            .tracking(1.1)
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }
}

#Preview {
    FeedView()
}
