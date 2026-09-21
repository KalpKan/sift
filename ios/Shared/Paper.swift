import Foundation

/// One paper as the Sift server hands it to the client.
///
/// `id` is whatever stable identifier the source gave us — a PubMed PMID for
/// MEDLINE records, a DOI for everything else — so it is a `String` rather than
/// an `Int` or a dedicated enum. Treating it as an opaque token means the client
/// never has to know which registry a paper came from, and a new source can be
/// added server-side without a client release.
struct Paper: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var journal: String
    /// Pre-collapsed byline ("Kansara et al."). The server sends this already
    /// shortened so the widget never has to carry a full author array into its
    /// ~30 MB extension process. `PaperFormatting.authorsShort(from:)` produces
    /// the same string when the client has to build it locally.
    var authorsShort: String
    var published: Date
    var doi: String?
    var url: URL?
    /// Server-assigned importance in 0...1. `FeedRanking` clamps it defensively
    /// rather than trusting the range.
    var score: Double
    var summary: String?
}

extension Paper {
    /// Lets the app and the widget render something real with no network and no
    /// shared container — which is exactly the state of a fresh install, and of
    /// every SwiftUI preview and widget gallery placeholder.
    static let samples: [Paper] = [
        Paper(
            id: "39284117",
            title: "Closed-loop cerebellar stimulation reduces tremor in spinocerebellar ataxia type 3",
            journal: "Brain",
            authorsShort: "Kansara et al.",
            published: Date(timeIntervalSinceReferenceDate: 780_000_000),
            doi: "10.1093/brain/awae284",
            url: URL(string: "https://doi.org/10.1093/brain/awae284"),
            score: 0.94,
            summary: "Sham-controlled crossover in 24 participants; 31% reduction in tremor amplitude."
        ),
        Paper(
            id: "10.1038/s41586-025-08801-w",
            title: "A 1,024-channel intracortical interface with on-array spike sorting",
            journal: "Nature",
            authorsShort: "Okafor & Lindqvist",
            published: Date(timeIntervalSinceReferenceDate: 779_800_000),
            doi: "10.1038/s41586-025-08801-w",
            url: URL(string: "https://doi.org/10.1038/s41586-025-08801-w"),
            score: 0.88,
            summary: "Chronic non-human primate recordings over 18 months without yield loss."
        ),
        Paper(
            id: "39271044",
            title: "Vagus nerve stimulation paired with rehabilitation after ischaemic stroke",
            journal: "The Lancet Neurology",
            authorsShort: "Ferreira et al.",
            published: Date(timeIntervalSinceReferenceDate: 779_400_000),
            doi: "10.1016/S1474-4422(25)00121-8",
            url: URL(string: "https://doi.org/10.1016/S1474-4422(25)00121-8"),
            score: 0.79,
            summary: nil
        ),
        Paper(
            id: "39260901",
            title: "Deep brain stimulation of the fastigial nucleus modulates cortical excitability",
            journal: "Journal of Neuroscience",
            authorsShort: "Voss et al.",
            published: Date(timeIntervalSinceReferenceDate: 778_900_000),
            doi: "10.1523/JNEUROSCI.0912-25.2025",
            url: URL(string: "https://doi.org/10.1523/JNEUROSCI.0912-25.2025"),
            score: 0.71,
            summary: "Mechanistic study in 14 patients with implanted electrodes."
        ),
        Paper(
            id: "39255310",
            title: "Ultrasonic neuromodulation of deep brain targets without craniotomy",
            journal: "Nature Biomedical Engineering",
            authorsShort: "Nakamura",
            published: Date(timeIntervalSinceReferenceDate: 778_100_000),
            doi: "10.1038/s41551-025-01402-x",
            url: URL(string: "https://doi.org/10.1038/s41551-025-01402-x"),
            score: 0.66,
            summary: nil
        )
    ]
}
