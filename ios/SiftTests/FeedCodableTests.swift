import XCTest

final class FeedCodableTests: XCTestCase {

    private func sampleFeed() -> Feed {
        Feed(
            id: "neuromod",
            name: "Neuromodulation",
            query: "deep brain stimulation AND ataxia",
            papers: [
                Paper(
                    id: "39123456",
                    title: "Cerebellar stimulation in spinocerebellar ataxia type 3",
                    journal: "Brain",
                    authorsShort: "Kansara et al.",
                    published: Date(timeIntervalSince1970: 1_699_000_000),
                    doi: "10.1093/brain/awad123",
                    url: URL(string: "https://doi.org/10.1093/brain/awad123"),
                    score: 0.91,
                    summary: "Sham-controlled crossover in 24 participants."
                ),
                Paper(
                    id: "10.1038/s41586-024-00000-0",
                    title: "A high-bandwidth intracortical interface",
                    journal: "Nature",
                    authorsShort: "Smith & Jones",
                    published: Date(timeIntervalSince1970: 1_699_500_000),
                    doi: nil,
                    url: nil,
                    score: 0.74,
                    summary: nil
                )
            ],
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
    }

    func testFeedRoundTripsThroughJSON() throws {
        let original = sampleFeed()
        let data = try SharedStore.encoder.encode(original)
        let decoded = try SharedStore.decoder.decode(Feed.self, from: data)
        XCTAssertEqual(decoded, original)
    }

    func testPaperRoundTripPreservesOptionalNils() throws {
        let original = sampleFeed().papers[1]
        let decoded = try SharedStore.decoder.decode(
            Paper.self,
            from: SharedStore.encoder.encode(original)
        )
        XCTAssertNil(decoded.doi)
        XCTAssertNil(decoded.url)
        XCTAssertNil(decoded.summary)
        XCTAssertEqual(decoded, original)
    }

    func testEmptyFeedRoundTrips() throws {
        let empty = Feed(id: "e", name: "Empty", query: "", papers: [], updatedAt: Date(timeIntervalSince1970: 0))
        let decoded = try SharedStore.decoder.decode(Feed.self, from: SharedStore.encoder.encode(empty))
        XCTAssertEqual(decoded, empty)
        XCTAssertTrue(decoded.papers.isEmpty)
    }

    /// The server team codes against this wire format, so pin it rather than
    /// letting a Swift default silently change it.
    func testDatesAreEncodedAsISO8601() throws {
        let data = try SharedStore.encoder.encode(sampleFeed())
        let json = String(decoding: data, as: UTF8.self)
        XCTAssertTrue(json.contains("2023-11-14T22:13:20Z"), "unexpected date encoding in: \(json)")
    }

    func testPaperIdentifiableUsesId() {
        let p = sampleFeed().papers[0]
        XCTAssertEqual(p.id, "39123456")
    }

    func testSamplesAreNonEmptyAndUniquelyIdentified() {
        XCTAssertFalse(Paper.samples.isEmpty)
        XCTAssertEqual(Set(Paper.samples.map(\.id)).count, Paper.samples.count)
        XCTAssertFalse(Feed.sample.papers.isEmpty)
    }
}

final class SharedStoreTests: XCTestCase {

    private var store: SharedStore!
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("SiftStoreTests-\(UUID().uuidString)", isDirectory: true)
        store = SharedStore(directory: tempDir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    func testLoadReturnsNilBeforeAnythingIsSaved() {
        XCTAssertNil(store.loadFeed())
    }

    func testSaveThenLoadRoundTrips() throws {
        let feed = Feed.sample
        try store.save(feed)
        XCTAssertEqual(store.loadFeed(), feed)
    }

    func testSaveOverwritesPreviousFeed() throws {
        try store.save(Feed.sample)
        var updated = Feed.sample
        updated.papers = Array(Feed.sample.papers.prefix(1))
        try store.save(updated)
        XCTAssertEqual(store.loadFeed()?.papers.count, 1)
    }

    func testLoadFeedOrSampleFallsBackWhenEmpty() {
        XCTAssertEqual(store.loadFeedOrSample().id, Feed.sample.id)
    }

    func testCorruptDataDoesNotThrowAndYieldsNil() throws {
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        try Data("not json".utf8).write(to: store.feedFileURL)
        XCTAssertNil(store.loadFeed(), "a corrupt cache must read as absent, never crash the widget")
    }

    /// There is no provisioning profile in a headless build, so the App Group container
    /// does not exist. The store must still work.
    func testFallsBackToALocalDirectoryWhenAppGroupIsUnavailable() throws {
        let fallbackStore = SharedStore(appGroupIdentifier: "group.invalid.does.not.exist")
        XCTAssertFalse(fallbackStore.isUsingAppGroup)
        try fallbackStore.save(Feed.sample)
        XCTAssertEqual(fallbackStore.loadFeed(), Feed.sample)
        try? FileManager.default.removeItem(at: fallbackStore.feedFileURL)
    }
}
