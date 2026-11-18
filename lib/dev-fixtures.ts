/**
 * Fixture data for the dev preview (`/dev/*`, see lib/dev-preview.ts). Fixed
 * instants, no randomness: screenshots of it are comparable run to run.
 * Nothing here is real reading data.
 */
import type { MePaper } from "@/lib/me-api";

export const DEV_NOW = new Date("2026-11-18T12:00:00Z");

const HOUR = 3600_000;
const ago = (hours: number) => new Date(DEV_NOW.getTime() - hours * HOUR).toISOString();

const LONG_TITLE =
  "A longitudinal multicentre randomised sham-controlled investigation of closed-loop adaptive deep brain stimulation " +
  "delivered through a chronically implanted sensing-capable pulse generator in patients with treatment-resistant " +
  "Parkinson disease, with beta-band biomarker tracking and patient-reported outcomes";

type Seed = {
  pmid: string;
  topic: string;
  title: string;
  journal: string;
  authors: string;
  hoursAgo: number;
  verdict?: 1 | -1 | null;
  reasons?: string[];
};

const SEEDS: Seed[] = [
  { pmid: "40000001", topic: "bci", title: "Speech decoding from intracortical arrays in a person with ALS", journal: "Nature", authors: "Chen L", hoursAgo: 5, reasons: ["intracortical"] },
  { pmid: "40000002", topic: "bci", title: "A fully implanted wireless brain-computer interface for home use", journal: "Nature Biomedical Engineering", authors: "Okafor T", hoursAgo: 20, verdict: 1, reasons: ["brain-computer interface"] },
  { pmid: "40000003", topic: "neural-engineering", title: "Flexible microelectrode arrays with stable chronic recording over twelve months", journal: "Science Advances", authors: "Novak P", hoursAgo: 40, reasons: ["microelectrode"] },
  { pmid: "40000004", topic: "dbs", title: LONG_TITLE, journal: "The Lancet Neurology and Experimental Clinical Neurosciences Supplement", authors: "Haddad R", hoursAgo: 90, reasons: ["deep brain stimulation"] },
  { pmid: "40000005", topic: "dbs", title: "Directional leads reduce stimulation side effects in essential tremor", journal: "Brain", authors: "Lindqvist E", hoursAgo: 130 },
  { pmid: "40000006", topic: "stem-cells", title: "Dopaminergic progenitor grafts restore motor function in a primate model", journal: "Cell Stem Cell", authors: "Tanaka Y", hoursAgo: 200, verdict: -1 },
  { pmid: "40000007", topic: "neural-engineering", title: "Ultrasound neuromodulation of deep targets without surgery", journal: "Neuron", authors: "Silva M", hoursAgo: 260, reasons: ["neuromodulation"] },
  { pmid: "40000008", topic: "bci", title: "Decoding handwriting from motor cortex with a recurrent decoder", journal: "Journal of Neural Engineering", authors: "Park J", hoursAgo: 330 },
  { pmid: "40000009", topic: "stem-cells", title: "Organoid transplantation integrates into adult rodent cortex", journal: "Nature Neuroscience", authors: "Moreau C", hoursAgo: 410 },
  { pmid: "40000010", topic: "dbs", title: "Subthalamic beta bursts predict freezing of gait", journal: "Movement Disorders", authors: "Ibrahim A", hoursAgo: 500 },
];

const papers: MePaper[] = SEEDS.map((s, i) => ({
  id: s.pmid,
  pmid: s.pmid,
  title: s.title,
  journal: s.journal,
  authorsShort: `${s.authors.split(" ")[0]} et al.`,
  published: ago(s.hoursAgo),
  doi: null,
  url: `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`,
  score: Math.round((0.95 - i * 0.07) * 100) / 100,
  orderScore: 95 - i * 7,
  summary: null,
  reasons: s.reasons ?? [],
  h1: 0.5,
  h1Quality: 0.5,
  topic: s.topic,
  shownRank: i + 1,
  recencyRank: i + 1,
  rankerVersion: "p1",
  verdict: s.verdict ?? null,
}));

export const DEV_RADAR_FEED: {
  query: string;
  updatedAt: string;
  rankerVersion: string;
  papers: MePaper[];
} = {
  query: "brain-computer interface, neural engineering, deep brain stimulation, stem cells",
  updatedAt: ago(3),
  rankerVersion: "p1",
  papers,
};

/** Topics for /dev/settings: the four followed fields on the radar, plus one not followed. */
export const DEV_TOPICS = [
  { slug: "bci", name: "Brain-computer interfaces", followed: true },
  { slug: "neural-engineering", name: "Neural engineering", followed: true },
  { slug: "dbs", name: "Deep brain stimulation", followed: true },
  { slug: "stem-cells", name: "Stem cells", followed: true },
  { slug: "neuromodulation", name: "Neuromodulation", followed: false },
];

export const DEV_INTERESTS: { term: string; weight: number; source: "obsidian" | "taps" | "manual" }[] = [
  { term: "brain-computer interface", weight: 0.8, source: "obsidian" },
  { term: "microelectrode", weight: 0.35, source: "taps" },
  { term: "organoid", weight: -0.2, source: "manual" },
];

/** The followed fields on the radar, in topic order: the map's clusters. */
export const DEV_FIELDS = DEV_TOPICS.filter((t) => t.followed).map((t) => ({ slug: t.slug, name: t.name }));
