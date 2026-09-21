import Foundation

/// The `sift://paper/<id>` contract shared by the widget (which builds the URL)
/// and the app (which parses it). Kept in `Shared/` so the two halves can never
/// drift apart -- a mismatched scheme here is a silently dead widget tap.
enum DeepLink {
    static let scheme = "sift"
    static let paperHost = "paper"

    /// Identifiers may be DOIs, which contain "/". Encoding the id into a single
    /// path component (so "/" becomes %2F) keeps `paperID(from:)` unambiguous;
    /// letting Foundation's default path encoding through would leave the slash
    /// literal and split one DOI across two path components.
    private static let identifierAllowed = CharacterSet.alphanumerics
        .union(CharacterSet(charactersIn: "-._~"))

    static func url(forPaperID id: String) -> URL? {
        guard let encoded = id.addingPercentEncoding(withAllowedCharacters: identifierAllowed),
              !encoded.isEmpty else { return nil }
        return URL(string: "\(scheme)://\(paperHost)/\(encoded)")
    }

    static func paperID(from url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == scheme,
              components.host?.lowercased() == paperHost else { return nil }

        // percentEncodedPath, not path: `path` would have already turned %2F back
        // into a real slash, at which point the DOI is indistinguishable from two
        // path components.
        var encodedPath = components.percentEncodedPath
        guard encodedPath.hasPrefix("/") else { return nil }
        encodedPath.removeFirst()
        guard !encodedPath.isEmpty,
              let id = encodedPath.removingPercentEncoding,
              !id.isEmpty else { return nil }
        return id
    }
}

/// The WidgetKit `kind` string. In `Shared/` because the app passes it to
/// `WidgetCenter.reloadTimelines(ofKind:)` and the widget declares it — a typo
/// across that boundary fails silently at runtime.
enum SiftWidgetKind {
    static let papers = "SiftPapersWidget"
}
