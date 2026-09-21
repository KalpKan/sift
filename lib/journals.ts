/**
 * A HAND-CURATED, HEURISTIC STOPGAP. Read this before using it for anything.
 *
 * WHAT THIS IS NOT:
 *   - It is not impact factor. Impact factor is a licensed Clarivate product;
 *     Sift costs $0 and will never pay for it, and impact factor is a bad
 *     measure of a single paper anyway.
 *   - It is not a ranking of journals by quality. It is a short list of
 *     venues where, in Kalp's specific fields, a paper appearing at all is
 *     itself weak evidence that somebody thought it mattered.
 *   - It is not complete, and it is biased toward what one person reads:
 *     English-language, Anglo-American, neuro-heavy, journal-shaped. Excellent
 *     work appears constantly in journals not on this list.
 *
 * WHY IT EXISTS ANYWAY: for engineering topics, publication type is nearly
 * useless (60% of papers have none), and this is the strongest free signal
 * left. An unlisted journal therefore scores ZERO, never negative — absence
 * from the list means "no information", not "bad". That asymmetry is the only
 * thing that makes a list this crude defensible.
 *
 * HOW TO CHANGE IT: add the journal exactly as PubMed's `fulljournalname`
 * spells it (lowercase, no trailing period). Matching is exact on a normalised
 * string, never a substring, so "Nature" cannot swallow "Nature reviews.
 * Urology".
 */

export type JournalTierName = "general" | "flagship" | "specialist";

/** Points added when a paper's journal is on the list. */
export const JOURNAL_TIER_POINTS: Record<JournalTierName, number> = {
  /** The four general-science/medicine venues where getting in is the signal. */
  general: 18,
  /** Field-defining journals: a paper here has cleared a very high bar. */
  flagship: 12,
  /** Strong, specialised venues in Kalp's fields. Real but weaker evidence. */
  specialist: 7,
};

const GENERAL = [
  "nature",
  "science",
  "cell",
  "the new england journal of medicine",
  "the lancet",
  "lancet",
  "jama",
];

const FLAGSHIP = [
  "nature medicine",
  "nature neuroscience",
  "nature biomedical engineering",
  "nature biotechnology",
  "nature methods",
  "neuron",
  "science translational medicine",
  "science robotics",
  "the lancet neurology",
  "lancet neurology",
  "jama neurology",
  "brain : a journal of neurology",
  "brain",
  "nature communications",
];

const SPECIALIST = [
  "journal of neural engineering",
  "brain stimulation",
  "annals of neurology",
  "movement disorders : official journal of the movement disorder society",
  "movement disorders",
  "the journal of neuroscience : the official journal of the society for neuroscience",
  "the journal of neuroscience",
  "elife",
  "neurology",
  "epilepsia",
  "the cerebellum",
  "cerebellum",
  "journal of neurosurgery",
  "neuromodulation : journal of the international neuromodulation society",
  "neuromodulation",
  "ieee transactions on biomedical engineering",
  "ieee transactions on neural systems and rehabilitation engineering",
  "journal of neurology, neurosurgery, and psychiatry",
  "current biology",
  "neuroimage",
  "npj parkinson's disease",
  "annals of clinical and translational neurology",
];

/**
 * PubMed's `fulljournalname` carries decorations this must ignore:
 *   "Sensors (Basel, Switzerland)"  -> "sensors"
 *   "Brain Stimulation."            -> "brain stimulation"
 *   "Neurology (Basel, Switzerland)"-> "neurology"
 * The colon-suffixed official titles ("Brain : a journal of neurology") are
 * listed in both forms above instead of being stripped, because stripping at
 * a colon would also mangle real distinct titles.
 */
export function normalizeJournal(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TIERS = new Map<string, JournalTierName>();
for (const n of GENERAL) TIERS.set(n, "general");
for (const n of FLAGSHIP) TIERS.set(n, "flagship");
for (const n of SPECIALIST) TIERS.set(n, "specialist");

export function journalTierName(journal: string | null | undefined): JournalTierName | null {
  if (!journal) return null;
  return TIERS.get(normalizeJournal(journal)) ?? null;
}

/** Points for a journal, or 0 for one that is simply not on the list. */
export function journalTier(journal: string | null | undefined): number {
  const tier = journalTierName(journal);
  return tier ? JOURNAL_TIER_POINTS[tier] : 0;
}

/** How many journals the list covers. Used by a test to keep it honest about its size. */
export const CURATED_JOURNAL_COUNT = TIERS.size;
