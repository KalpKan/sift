import PaperLink from "./PaperLink";
import type { FeedPaper } from "@/lib/feed";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "20 Sep 2026", in UTC. Deliberately an absolute date rather than "3 days
 * ago": a relative string rendered on the server is wrong the moment the page
 * is cached, and the ranker already puts the age in `reasons`. Hand-formatted
 * rather than `toLocaleDateString` so the output does not depend on the
 * server's locale, which would differ from the reader's.
 */
export function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * One entry in the table of contents.
 *
 * Hierarchy, in order of what the eye should hit: the title (serif, large,
 * the only thing set at full contrast), then the byline and journal, then the
 * ranker's reasons, then the score. The rank number is set in the margin and
 * kept faint — it is an index, not a verdict.
 *
 * Proximity does the grouping, so there is no card and no border around an
 * entry; the hairline rule belongs to the list, not to the item.
 */
export default function PaperEntry({
  paper,
  rank,
  topic,
}: {
  paper: FeedPaper;
  rank: number;
  topic: string;
}) {
  const href = paper.url ?? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const meta = [paper.authorsShort, paper.journal, formatDate(paper.published)].filter(Boolean).join(" · ");

  return (
    <article className="grid grid-cols-[2ch_1fr] gap-x-4 py-6 sm:grid-cols-[3ch_1fr_4ch] sm:gap-x-6">
      <span aria-hidden className="tabular pt-1 text-sm text-ink-faint">
        {rank}
      </span>

      <div className="min-w-0">
        <h3 className="font-serif text-lg leading-snug sm:text-xl">
          <PaperLink
            href={href}
            topic={topic}
            rank={rank}
            className="decoration-rule underline underline-offset-4 transition-colors hover:decoration-rule-strong"
          >
            {paper.title}
          </PaperLink>
        </h3>

        {meta && <p className="mt-2 text-sm text-ink-muted">{meta}</p>}

        {paper.reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {/*
              WHY the paper ranked, in the ranker's own words. This is the
              feature that makes a mediocre heuristic usable: a reader who can
              see "case report" or "offline benchmark study" can overrule it
              instantly, and can tell when the ranker is being stupid.
            */}
            {paper.reasons.map((reason) => (
              <li key={reason} className="text-xs text-ink-faint">
                {reason}
              </li>
            ))}
          </ul>
        )}

        {/* On a phone the score moves under the entry rather than into a third
            column, which would squeeze the titles to four words a line. */}
        <p className="tabular mt-3 text-xs text-ink-faint sm:hidden">
          score {Math.round(paper.score * 100)}
        </p>
      </div>

      <p className="tabular hidden pt-1 text-right text-sm text-ink-faint sm:block">
        {Math.round(paper.score * 100)}
      </p>
    </article>
  );
}
