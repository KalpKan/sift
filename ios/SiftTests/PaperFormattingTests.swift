import XCTest

/// `Shared/` is compiled into this test target directly (see project.pbxproj
/// `fileSystemSynchronizedGroups`), so there is no module to import.
final class PaperFormattingTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func ago(_ seconds: TimeInterval) -> Date {
        now.addingTimeInterval(-seconds)
    }

    // MARK: - relativeAge

    func testRelativeAgeUnderOneMinuteReadsAsNow() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(0), now: now), "now")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(59), now: now), "now")
    }

    func testRelativeAgeInMinutes() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(60), now: now), "1m")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(45 * 60), now: now), "45m")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(59 * 60 + 59), now: now), "59m")
    }

    func testRelativeAgeInHours() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(3600), now: now), "1h")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(2 * 3600), now: now), "2h")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(23 * 3600 + 3599), now: now), "23h")
    }

    func testRelativeAgeInDays() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(86_400), now: now), "1d")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(3 * 86_400), now: now), "3d")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(6 * 86_400 + 86_399), now: now), "6d")
    }

    func testRelativeAgeInWeeks() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(7 * 86_400), now: now), "1w")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(20 * 86_400), now: now), "2w")
        XCTAssertEqual(PaperFormatting.relativeAge(of: ago(365 * 86_400), now: now), "52w")
    }

    /// Clock skew between the server's `published` and the device clock must not print "-3h".
    func testRelativeAgeClampsFutureDatesToNow() {
        XCTAssertEqual(PaperFormatting.relativeAge(of: now.addingTimeInterval(9_999), now: now), "now")
    }

    // MARK: - truncatedTitle

    func testTruncatedTitleShorterThanLimitIsUnchanged() {
        let short = "Deep brain stimulation"
        XCTAssertEqual(PaperFormatting.truncatedTitle(short, maxChars: 40), short)
    }

    func testTruncatedTitleExactlyAtLimitIsUnchanged() {
        let s = String(repeating: "a", count: 20)
        XCTAssertEqual(PaperFormatting.truncatedTitle(s, maxChars: 20), s)
    }

    func testTruncatedTitleBreaksOnWordBoundary() {
        let title = "Closed-loop deep brain stimulation for essential tremor"
        let out = PaperFormatting.truncatedTitle(title, maxChars: 30)
        XCTAssertTrue(out.hasSuffix("\u{2026}"), "expected an ellipsis, got \(out)")
        XCTAssertFalse(out.dropLast().hasSuffix(" "), "no dangling space before the ellipsis")
        // Must not slice a word in half.
        XCTAssertTrue(title.hasPrefix(String(out.dropLast())))
        XCTAssertEqual(out, "Closed-loop deep brain\u{2026}")
    }

    func testTruncatedTitleWithNoSpacesHardCuts() {
        let title = String(repeating: "x", count: 100)
        let out = PaperFormatting.truncatedTitle(title, maxChars: 10)
        XCTAssertEqual(out, String(repeating: "x", count: 10) + "\u{2026}")
    }

    func testTruncatedTitleEmptyStringStaysEmpty() {
        XCTAssertEqual(PaperFormatting.truncatedTitle("", maxChars: 10), "")
    }

    func testTruncatedTitleNonPositiveLimitIsEmpty() {
        XCTAssertEqual(PaperFormatting.truncatedTitle("anything", maxChars: 0), "")
    }

    func testTruncatedTitleStripsTrailingPunctuationBeforeEllipsis() {
        let out = PaperFormatting.truncatedTitle("Neuromodulation, plasticity and recovery", maxChars: 20)
        XCTAssertEqual(out, "Neuromodulation\u{2026}")
    }

    // MARK: - authorsShort

    func testAuthorsShortEmpty() {
        XCTAssertEqual(PaperFormatting.authorsShort(from: []), "")
    }

    func testAuthorsShortSingle() {
        XCTAssertEqual(PaperFormatting.authorsShort(from: ["Jane Smith"]), "Smith")
    }

    func testAuthorsShortPair() {
        XCTAssertEqual(PaperFormatting.authorsShort(from: ["Jane Smith", "Ada Jones"]), "Smith & Jones")
    }

    func testAuthorsShortThreeOrMore() {
        XCTAssertEqual(
            PaperFormatting.authorsShort(from: ["Kalp Kansara", "Ada Jones", "Jane Smith"]),
            "Kansara et al."
        )
    }

    func testAuthorsShortHandlesSurnameFirstForm() {
        XCTAssertEqual(PaperFormatting.authorsShort(from: ["Smith, Jane A."]), "Smith")
    }

    func testAuthorsShortIgnoresBlankEntries() {
        XCTAssertEqual(PaperFormatting.authorsShort(from: ["  ", "Jane Smith"]), "Smith")
    }
}
