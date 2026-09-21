import XCTest

/// These tests never touch the network. `feed-neuromodulation.json` was
/// recorded from the live server on 2026-09-21 with
///   curl "https://sift.kalpkan.com/api/feed?topic=neuromodulation&limit=3"
/// so the decoder is pinned against the real response shape, not against a
/// hand-written guess at it.
final class SiftAPITests: XCTestCase {
    private func fixture() throws -> Data {
        let url = try XCTUnwrap(
            Bundle(for: Self.self).url(forResource: "feed-neuromodulation", withExtension: "json"),
            "fixture missing from the test bundle"
        )
        return try Data(contentsOf: url)
    }

    func testDecodesTheRealServerResponse() throws {
        let feed = try SiftAPI.decodeFeed(try fixture())
        XCTAssertEqual(feed.id, "neuromodulation")
        XCTAssertEqual(feed.name, "Neuromodulation")
        XCTAssertEqual(feed.papers.count, 3)
        XCTAssertFalse(feed.query.isEmpty, "the query travels with the feed so a stale cache is self-describing")
    }

    func testDecodesAPaperFully() throws {
        let paper = try XCTUnwrap(try SiftAPI.decodeFeed(try fixture()).papers.first)
        XCTAssertFalse(paper.id.isEmpty)
        XCTAssertFalse(paper.title.isEmpty)
        XCTAssertFalse(paper.authorsShort.isEmpty)
        XCTAssertNotNil(paper.url)
        // The server sends quality-only in 0...1; the phone adds its own
        // recency term. A value outside this range means the contract broke.
        XCTAssertGreaterThanOrEqual(paper.score, 0)
        XCTAssertLessThanOrEqual(paper.score, 1)
    }

    /// The server sends fields `Feed` does not model (`topic`, `pmid`,
    /// `orderScore`, `reasons`). Decoding must ignore them rather than fail,
    /// because the server ships far more often than the app can.
    func testUnknownServerFieldsAreIgnored() throws {
        let json = Data("""
        {"topic":"x","id":"x","name":"X","query":"q","updatedAt":"2026-09-21T06:31:11Z",
         "somethingNew":42,
         "papers":[{"id":"1","pmid":"1","title":"T","journal":"J","authorsShort":"A et al.",
                    "published":"2026-09-15T00:00:00Z","url":"https://example.org","score":0.5,
                    "orderScore":107,"reasons":["a"],"summary":null,"alsoNew":true}]}
        """.utf8)
        let feed = try SiftAPI.decodeFeed(json)
        XCTAssertEqual(feed.papers.count, 1)
        XCTAssertEqual(feed.papers[0].score, 0.5, accuracy: 0.0001)
    }

    func testAcceptsBothDateShapesTheServerSends() throws {
        // `published` has no fractional seconds, `updatedAt` does. Foundation's
        // plain .iso8601 strategy accepts only the first, which is exactly the
        // bug this guards: it would pass a hand-written fixture and fail on
        // every real response.
        let feed = try SiftAPI.decodeFeed(try fixture())
        XCTAssertGreaterThan(feed.updatedAt.timeIntervalSince1970, 0, "fractional-seconds date decoded")
        XCTAssertGreaterThan(try XCTUnwrap(feed.papers.first).published.timeIntervalSince1970, 0,
                             "whole-seconds date decoded")
    }

    func testRejectsADateWithoutAZone() {
        // Guards the contract in the other direction: if the server ever
        // regresses to a bare "2026-09-15", we want a loud failure here rather
        // than a silent empty widget on someone's Lock Screen.
        let json = Data("""
        {"id":"x","name":"X","query":"q","updatedAt":"2026-09-21","papers":[]}
        """.utf8)
        XCTAssertThrowsError(try SiftAPI.decodeFeed(json))
    }

    func testFeedURLCarriesTopicAndLimit() {
        let url = SiftAPI.feedURL(topic: "brain-computer-interfaces", limit: 5)
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        XCTAssertEqual(url.host, "sift.kalpkan.com")
        XCTAssertEqual(url.path, "/api/feed")
        XCTAssertEqual(items.first(where: { $0.name == "topic" })?.value, "brain-computer-interfaces")
        XCTAssertEqual(items.first(where: { $0.name == "limit" })?.value, "5")
    }

    func testBadStatusIsAnError() {
        XCTAssertEqual(SiftAPIError.badStatus(503), SiftAPIError.badStatus(503))
        XCTAssertNotEqual(SiftAPIError.badStatus(503), SiftAPIError.badStatus(404))
    }
}
