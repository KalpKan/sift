import XCTest

final class FeedRankingTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func paper(
        _ id: String,
        score: Double,
        daysOld: Double,
        title: String = "T"
    ) -> Paper {
        Paper(
            id: id,
            title: title,
            journal: "Nature",
            authorsShort: "Smith et al.",
            published: now.addingTimeInterval(-daysOld * 86_400),
            doi: nil,
            url: nil,
            score: score,
            summary: nil
        )
    }

    func testRankingEmptyFeedReturnsEmpty() {
        XCTAssertTrue(FeedRanking.rank([], now: now).isEmpty)
    }

    func testRankingSingleItemIsIdentity() {
        let p = paper("a", score: 0.1, daysOld: 40)
        XCTAssertEqual(FeedRanking.rank([p], now: now), [p])
    }

    func testHigherScoreWinsAtEqualAge() {
        let low = paper("low", score: 0.2, daysOld: 1)
        let high = paper("high", score: 0.9, daysOld: 1)
        XCTAssertEqual(FeedRanking.rank([low, high], now: now).map(\.id), ["high", "low"])
    }

    func testFresherWinsAtEqualScore() {
        let old = paper("old", score: 0.5, daysOld: 30)
        let fresh = paper("fresh", score: 0.5, daysOld: 0)
        XCTAssertEqual(FeedRanking.rank([old, fresh], now: now).map(\.id), ["fresh", "old"])
    }

    /// The whole point of the blend: a merely-good paper from today should beat a
    /// great paper from a month ago, but not a great paper from today.
    func testRecencyCanOutrankScore() {
        let staleGreat = paper("staleGreat", score: 1.0, daysOld: 60)
        let freshGood = paper("freshGood", score: 0.6, daysOld: 0)
        XCTAssertEqual(
            FeedRanking.rank([staleGreat, freshGood], now: now).map(\.id),
            ["freshGood", "staleGreat"]
        )
    }

    func testScoreStillDominatesAtEqualFreshness() {
        let a = paper("a", score: 1.0, daysOld: 0)
        let b = paper("b", score: 0.6, daysOld: 0)
        XCTAssertEqual(FeedRanking.rank([a, b], now: now).map(\.id), ["a", "b"])
    }

    func testTiesAreBrokenDeterministicallyByIdAscending() {
        // Identical score and identical timestamp -> id ascending, regardless of input order.
        let z = paper("zzz", score: 0.5, daysOld: 2)
        let a = paper("aaa", score: 0.5, daysOld: 2)
        let m = paper("mmm", score: 0.5, daysOld: 2)
        XCTAssertEqual(FeedRanking.rank([z, a, m], now: now).map(\.id), ["aaa", "mmm", "zzz"])
        XCTAssertEqual(FeedRanking.rank([m, z, a], now: now).map(\.id), ["aaa", "mmm", "zzz"])
    }

    func testRankingIsStableAcrossRepeatedCalls() {
        let input = (0..<12).map { paper("p\($0)", score: Double($0 % 3) / 2.0, daysOld: Double($0 % 4)) }
        let first = FeedRanking.rank(input, now: now).map(\.id)
        let second = FeedRanking.rank(input.reversed(), now: now).map(\.id)
        XCTAssertEqual(first, second)
    }

    func testRankingPreservesEveryElement() {
        let input = (0..<7).map { paper("p\($0)", score: Double($0) / 7.0, daysOld: Double($0)) }
        let ranked = FeedRanking.rank(input, now: now)
        XCTAssertEqual(ranked.count, input.count)
        XCTAssertEqual(Set(ranked.map(\.id)), Set(input.map(\.id)))
    }

    func testScoreIsClampedSoOutOfRangeServerScoresCannotDominate() {
        // A buggy server sending 1000.0 must not make recency irrelevant forever.
        let absurd = paper("absurd", score: 1000.0, daysOld: 400)
        let sane = paper("sane", score: 1.0, daysOld: 0)
        XCTAssertEqual(FeedRanking.rank([absurd, sane], now: now).map(\.id), ["sane", "absurd"])
    }

    func testRecencyWeightIsInUnitInterval() {
        XCTAssertGreaterThan(FeedRanking.recencyWeight, 0)
        XCTAssertLessThan(FeedRanking.recencyWeight, 1)
        XCTAssertGreaterThan(FeedRanking.recencyHalfLifeDays, 0)
    }

    func testFutureDatesAreTreatedAsBrandNew() {
        let future = paper("future", score: 0.5, daysOld: -3)
        let today = paper("today", score: 0.5, daysOld: 0)
        // Both are maximally fresh, so the id tiebreak decides -- not a runaway future bonus.
        XCTAssertEqual(FeedRanking.rank([future, today], now: now).map(\.id), ["future", "today"])
    }
}
