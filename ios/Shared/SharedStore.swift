import Foundation

/// The one channel between the app and the widget: a single JSON file the app
/// writes and the widget reads.
///
/// A widget extension cannot fetch (it is not continuously running, and the
/// system renders a pre-archived view rather than executing code at draw time),
/// so all networking happens in the app, which writes here and then calls
/// `WidgetCenter.reloadTimelines`. Nothing in this type touches the network.
///
/// A `struct` rather than a class so it is trivially `Sendable` and can be
/// constructed on whatever queue a timeline request arrives on.
struct SharedStore: Sendable {

    static let appGroupIdentifier = "group.com.kalpkan.sift"

    /// Shared by the encoder/decoder and by the tests that pin the wire format.
    /// `.iso8601` so the JSON stays readable and language-neutral for the server
    /// team; `.sortedKeys` so a re-save of unchanged data produces identical
    /// bytes and does not churn the file's modification date.
    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    let directory: URL

    /// False when we fell back to a process-local directory. Worth surfacing:
    /// in that state the app and widget are no longer talking to each other,
    /// which otherwise looks like a mysteriously stale widget.
    let isUsingAppGroup: Bool

    /// Explicit directory — used by tests, and by anything that wants an
    /// isolated store.
    init(directory: URL) {
        self.directory = directory
        self.isUsingAppGroup = false
    }

    /// The real initializer. Degrades to a local directory when the App Group
    /// container is unavailable, which is the case in any build without the
    /// matching entitlement (CI, this headless build, unit tests). Trapping
    /// here instead would make the whole app untestable without provisioning.
    init(appGroupIdentifier: String = SharedStore.appGroupIdentifier) {
        if let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            self.directory = container.appendingPathComponent("Sift", isDirectory: true)
            self.isUsingAppGroup = true
        } else {
            let base = (try? FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: false
            )) ?? URL(fileURLWithPath: NSTemporaryDirectory())
            self.directory = base.appendingPathComponent("SiftFallback", isDirectory: true)
            self.isUsingAppGroup = false
        }
    }

    var feedFileURL: URL { directory.appendingPathComponent("feed.json") }

    /// Atomic write: the widget may read this file at any moment, and a torn
    /// half-written JSON would read as a corrupt (empty) feed.
    func save(_ feed: Feed) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try Self.encoder.encode(feed)
        try data.write(to: feedFileURL, options: .atomic)
    }

    /// Non-throwing on purpose. Every caller is a render path with a sensible
    /// fallback, and there is nothing useful a widget can do with a decode
    /// error except show something else.
    func loadFeed() -> Feed? {
        guard let data = try? Data(contentsOf: feedFileURL) else { return nil }
        return try? Self.decoder.decode(Feed.self, from: data)
    }

    /// What every render path actually wants: never an empty screen.
    func loadFeedOrSample() -> Feed { loadFeed() ?? .sample }

    func clear() {
        try? FileManager.default.removeItem(at: feedFileURL)
    }
}
