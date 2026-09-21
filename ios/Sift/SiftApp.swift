import SwiftUI
import WidgetKit

@main
struct SiftApp: App {
    var body: some Scene {
        WindowGroup {
            FeedView()
        }
    }
}

/// Owns the feed and the deep-link selection. Separated from the view so the
/// view stays a pure function of this state.
@MainActor
final class FeedModel: ObservableObject {

    @Published private(set) var feed: Feed
    /// Set by a widget tap; cleared shortly after so the highlight is a cue,
    /// not a persistent selection the user then has to dismiss.
    @Published var highlightedPaperID: String?

    private let store: SharedStore

    init(store: SharedStore = SharedStore()) {
        self.store = store
        self.feed = store.loadFeedOrSample()
    }

    /// Ranked once, here, so the app and the widget cannot disagree about which
    /// paper is first — the widget deep-links by id, and a differently ordered
    /// list in the app would scroll to the wrong row.
    func rankedPapers(now: Date = .now) -> [Paper] {
        FeedRanking.rank(feed.papers, now: now)
    }

    /// Seeds the shared container on first launch so the widget has something
    /// real to show before any network layer exists. The reload call is the
    /// other half of the contract: the widget never fetches, so it only learns
    /// about new data when the app tells it to.
    func publishToWidget() {
        guard store.loadFeed() == nil else { return }
        try? store.save(feed)
        WidgetCenter.shared.reloadTimelines(ofKind: SiftWidgetKind.papers)
    }

    func handleDeepLink(_ url: URL) {
        guard let id = DeepLink.paperID(from: url),
              feed.papers.contains(where: { $0.id == id }) else { return }
        highlightedPaperID = id
    }

    func clearHighlight(_ id: String) {
        if highlightedPaperID == id { highlightedPaperID = nil }
    }
}
