import Foundation

/// A saved search plus the papers it currently matches.
///
/// The app is built around several of these ("Neuromodulation", "BCI"), so the
/// query travels with the results: the widget can label what it is showing
/// without a second lookup, and a stale cache is still self-describing.
struct Feed: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var query: String
    var papers: [Paper]
    /// When the server last recomputed this feed -- not when we downloaded it.
    /// Freshness the user cares about is the former.
    var updatedAt: Date
}

extension Feed {
    static let sample = Feed(
        id: "neuromodulation",
        name: "Neuromodulation",
        query: "(deep brain stimulation OR vagus nerve stimulation) AND ataxia",
        papers: Paper.samples,
        updatedAt: Date(timeIntervalSinceReferenceDate: 780_100_000)
    )
}
