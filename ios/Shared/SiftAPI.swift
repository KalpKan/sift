import Foundation

/// Talks to the Sift server at sift.kalpkan.com.
///
/// **Only the app ever calls this.** A widget renders a pre-archived snapshot
/// and cannot run code while it is on screen, so the widget reads whatever the
/// app last wrote into `SharedStore` and never touches the network itself.
/// See `docs/widget-constraints.md`.
enum SiftAPI {
    /// Where the feed lives. A constant rather than a setting because there is
    /// one server and hard-coding it keeps the app free of configuration.
    static let baseURL = URL(string: "https://sift.kalpkan.com")!

    /// The JSON the server sends is a superset of `Feed`: it also carries
    /// `topic`, and each paper carries `pmid`, `orderScore` and `reasons`.
    /// Swift's synthesised `Codable` ignores unknown keys, so `Feed` decodes
    /// straight out of it and the server can add fields without breaking a
    /// shipped app. That is deliberate — an iOS release is slow, and with no
    /// Apple Developer Program membership it is currently impossible.
    static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        // Both ISO 8601 shapes the server actually emits, which are NOT the
        // same: `published` is "2026-09-15T00:00:00Z" but `updatedAt` is
        // "2026-09-21T06:31:11.959Z" with fractional seconds, because it comes
        // from a JavaScript `Date.toISOString()`. Foundation's plain `.iso8601`
        // strategy rejects fractional seconds outright, so using it would have
        // made the app fail to decode every real response while passing every
        // hand-written test. Found by pinning the decoder to a recorded live
        // response; there is a regression test for each shape below.
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]

        d.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            if let date = withFraction.date(from: text) ?? plain.date(from: text) { return date }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath,
                      debugDescription: "not an ISO 8601 date with a time zone: \(text)")
            )
        }
        return d
    }

    static func feedURL(topic: String, limit: Int = 10) -> URL {
        var c = URLComponents(url: baseURL.appendingPathComponent("api/feed"), resolvingAgainstBaseURL: false)!
        c.queryItems = [
            URLQueryItem(name: "topic", value: topic),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        return c.url!
    }

    /// Decode a feed from raw response bytes. Separated from the network call
    /// so the decoding is testable against a recorded fixture with no network.
    static func decodeFeed(_ data: Data) throws -> Feed {
        try decoder().decode(Feed.self, from: data)
    }

    /// Fetch one topic's feed. Throws on a non-2xx response so the caller can
    /// keep showing the cached feed rather than replacing it with nothing —
    /// a stale paper is useful, an empty widget is not.
    static func fetchFeed(topic: String, limit: Int = 10, session: URLSession = .shared) async throws -> Feed {
        var request = URLRequest(url: feedURL(topic: topic, limit: limit))
        // The feed is recomputed server-side at most every six hours, so a
        // short client timeout is right: if the server is slow we would rather
        // keep the cache than block a launch.
        request.timeoutInterval = 15
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SiftAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try decodeFeed(data)
    }
}

enum SiftAPIError: Error, Equatable {
    case badStatus(Int)
}
