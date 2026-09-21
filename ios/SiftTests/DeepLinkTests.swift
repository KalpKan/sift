import XCTest

final class DeepLinkTests: XCTestCase {

    func testParsesPaperDeepLink() {
        XCTAssertEqual(DeepLink.paperID(from: URL(string: "sift://paper/39123456")!), "39123456")
    }

    func testParsesPercentEncodedDOIIdentifier() {
        // DOIs contain slashes, so the widget percent-encodes the id into a single path component.
        let url = URL(string: "sift://paper/10.1038%2Fs41586-024-00000-0")!
        XCTAssertEqual(DeepLink.paperID(from: url), "10.1038/s41586-024-00000-0")
    }

    func testRejectsForeignScheme() {
        XCTAssertNil(DeepLink.paperID(from: URL(string: "https://example.com/paper/1")!))
    }

    func testRejectsWrongHost() {
        XCTAssertNil(DeepLink.paperID(from: URL(string: "sift://feed/39123456")!))
    }

    func testRejectsMissingIdentifier() {
        XCTAssertNil(DeepLink.paperID(from: URL(string: "sift://paper")!))
        XCTAssertNil(DeepLink.paperID(from: URL(string: "sift://paper/")!))
    }

    func testBuildingAndParsingAreInverses() throws {
        for id in ["39123456", "10.1038/s41586-024-00000-0", "a b"] {
            let url = try XCTUnwrap(DeepLink.url(forPaperID: id))
            XCTAssertEqual(DeepLink.paperID(from: url), id, "round trip failed for \(id)")
        }
    }
}
