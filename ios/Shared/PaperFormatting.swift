import Foundation

/// Pure string formatting for the compact surfaces (widget, list rows).
///
/// Deliberately not `DateFormatter`/`RelativeDateTimeFormatter`: those are
/// locale-dependent and produce "2 hours ago", which is far too long for an
/// accessoryRectangular widget, and they make tests depend on the test
/// machine's locale. `now` is injected rather than read from the clock so every
/// case below is deterministic.
enum PaperFormatting {

    // MARK: - Age

    private static let minute: TimeInterval = 60
    private static let hour: TimeInterval = 60 * 60
    private static let day: TimeInterval = 24 * 60 * 60
    private static let week: TimeInterval = 7 * 24 * 60 * 60

    /// Single-unit age, truncated down: "now", "45m", "2h", "3d", "7w".
    ///
    /// Truncation (not rounding) is intentional -- a paper 1.9 hours old reading
    /// as "1h" is honest; reading as "2h" claims it is older than it is.
    static func relativeAge(of date: Date, now: Date) -> String {
        // Server and device clocks disagree; a future timestamp must never print
        // a negative age, so clamp instead.
        let elapsed = max(0, now.timeIntervalSince(date))

        if elapsed < minute { return "now" }
        if elapsed < hour { return "\(Int(elapsed / minute))m" }
        if elapsed < day { return "\(Int(elapsed / hour))h" }
        if elapsed < week { return "\(Int(elapsed / day))d" }
        return "\(Int(elapsed / week))w"
    }

    // MARK: - Title

    private static let ellipsis = "\u{2026}"

    /// Truncates on a word boundary and appends a single-character ellipsis.
    ///
    /// `maxChars` bounds the *text*, so the returned string is at most
    /// `maxChars + 1` characters. Callers are sizing against a fixed widget
    /// rectangle, and reserving the ellipsis inside the budget would make short
    /// limits (10-20 chars, the rectangular lock-screen case) lose a real word.
    static func truncatedTitle(_ title: String, maxChars: Int) -> String {
        guard maxChars > 0 else { return "" }
        guard title.count > maxChars else { return title }

        let head = title.prefix(maxChars)
        // Cut back to the last whitespace so a word is never sliced in half. A
        // title with no whitespace in range (a long identifier, CJK text) has no
        // boundary to find, so hard-cut rather than return nothing.
        var kept = head
        if let lastSpace = head.lastIndex(where: { $0.isWhitespace }) {
            kept = head[head.startIndex..<lastSpace]
        }

        // "Neuromodulation," + "…" reads as a typo; drop trailing punctuation.
        while let last = kept.last, last.isWhitespace || last.isPunctuation || last.isSymbol {
            kept = kept.dropLast()
        }
        if kept.isEmpty { kept = head }

        return kept + ellipsis
    }

    // MARK: - Authors

    /// Journal-style byline: "Smith", "Smith & Jones", "Smith et al.".
    ///
    /// Mirrors what the server puts in `Paper.authorsShort`, so a client that
    /// builds a `Paper` from raw author lists produces byte-identical output.
    static func authorsShort(from authors: [String]) -> String {
        let surnames = authors
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map(surname(of:))
            .filter { !$0.isEmpty }

        switch surnames.count {
        case 0: return ""
        case 1: return surnames[0]
        case 2: return "\(surnames[0]) & \(surnames[1])"
        default: return "\(surnames[0]) et al."
        }
    }

    /// Handles both citation orders we see in the wild: "Smith, Jane A."
    /// (Crossref) and "Jane A. Smith" (PubMed's display form).
    private static func surname(of name: String) -> String {
        if let comma = name.firstIndex(of: ",") {
            return String(name[name.startIndex..<comma]).trimmingCharacters(in: .whitespaces)
        }
        return name.split(whereSeparator: { $0.isWhitespace }).last.map(String.init) ?? ""
    }
}
