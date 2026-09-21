import Foundation

/// Orders a feed for display. Pure and deterministic: the same input always
/// produces the same output, because the widget and the app must agree on which
/// paper is "the top paper" without coordinating.
enum FeedRanking {

    /// How much of the final ordering recency is allowed to buy, 0...1.
    ///
    /// 0.35 is the one number to turn. Below ~0.2 the list becomes an all-time
    /// greatest-hits chart that barely moves day to day; above ~0.5 a trivial
    /// paper published this morning displaces a landmark from last week. At 0.35
    /// a same-day paper needs to score roughly 0.35 lower than a week-old rival
    /// to still lose, which is the behaviour a researcher expects from a
    /// "what's new that matters" feed.
    static let recencyWeight: Double = 0.35

    /// Days for the recency term to halve. Three days spans a working weekend,
    /// so a Friday paper is still visibly fresh on Monday morning.
    static let recencyHalfLifeDays: Double = 3.0

    /// Exponential decay rather than a linear "days old" term: linear decay has
    /// to pick an arbitrary cutoff age, and everything past it ranks identically.
    /// Decay degrades smoothly and never goes negative.
    static func recencyScore(published: Date, now: Date) -> Double {
        // Future timestamps (clock skew) are treated as maximally fresh, not as
        // a bonus above 1.0.
        let ageDays = max(0, now.timeIntervalSince(published)) / 86_400
        return pow(0.5, ageDays / recencyHalfLifeDays)
    }

    /// Combined 0...1 rank value. `score` is clamped because it comes off the
    /// network: an out-of-range value from a buggy server must not be able to
    /// swamp the recency term permanently.
    static func combinedScore(for paper: Paper, now: Date) -> Double {
        let quality = min(max(paper.score, 0), 1)
        let recency = recencyScore(published: paper.published, now: now)
        return (1 - recencyWeight) * quality + recencyWeight * recency
    }

    /// Highest combined score first.
    ///
    /// Ties are broken explicitly (newer first, then id ascending) rather than
    /// left to `sorted(by:)`, whose sort is not guaranteed stable. Without this
    /// two equally-ranked papers could swap places between the app and the
    /// widget, and the widget would deep-link to a different paper than the one
    /// it is showing.
    static func rank(_ papers: [Paper], now: Date) -> [Paper] {
        papers
            .map { (paper: $0, rank: combinedScore(for: $0, now: now)) }
            .sorted { lhs, rhs in
                if lhs.rank != rhs.rank { return lhs.rank > rhs.rank }
                if lhs.paper.published != rhs.paper.published {
                    return lhs.paper.published > rhs.paper.published
                }
                return lhs.paper.id < rhs.paper.id
            }
            .map(\.paper)
    }
}
