import type { CSSProperties } from "react";
import { dotClass } from "@/components/brain/rowDot";
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
 * One entry in a public list (docs/design/brain.md section 7), the same
 * anatomy as the private radar row: rank and a dot in the field's hue, the
 * title as the largest and darkest thing, meta, reasons led by the word `new`
 * when the paper is under 48 hours old, and the score. Public rows carry no
 * topic (the whole page is one topic) and no rating buttons.
 *
 * `hue` is the topic's cluster index (0-3), `isNew` is decided by the page on
 * the server so the markup never depends on the clock. Both are public data.
 *
 * Proximity does the grouping, so there is no card and no border around an
 * entry; the hairline rule belongs to the list, not to the item.
 */
export default function PaperEntry({
  paper,
  rank,
  topic,
  hue = 0,
  isNew = false,
}: {
  paper: FeedPaper;
  rank: number;
  topic: string;
  hue?: number;
  isNew?: boolean;
}) {
  const href = paper.url ?? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const meta = [paper.authorsShort, paper.journal, formatDate(paper.published)].filter(Boolean).join(" · ");

  return (
    <article
      style={{ "--c": `var(--cluster-${(hue % 4) + 1})` } as CSSProperties}
      className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-[10px] py-[18px] sm:grid-cols-[44px_minmax(0,1fr)_88px] sm:gap-x-3 sm:py-5"
    >
      <div className="flex flex-col items-start gap-[7px] pt-[5px] sm:flex-row sm:items-baseline sm:gap-[10px]">
        <span aria-hidden className="tabular font-mono text-xs leading-[1.3] text-ink-faint">
          {rank}
        </span>
        <span
          aria-hidden
          className={`inline-block size-2 flex-none rounded-full sm:-translate-y-px ${dotClass(null, isNew)}`}
        />
      </div>

      <div className="min-w-0">
        <h3 className="font-serif text-[18px] leading-[1.32] sm:text-[20px] sm:leading-[1.3]">
          <PaperLink
            href={href}
            topic={topic}
            rank={rank}
            className="[overflow-wrap:anywhere] decoration-ink decoration-1 underline-offset-4 hover:underline focus-visible:underline"
          >
            {paper.title}
          </PaperLink>
        </h3>

        {meta && <p className="mt-1.5 text-[13px] leading-[1.45] text-ink-muted [overflow-wrap:anywhere]">{meta}</p>}

        {(isNew || paper.reasons.length > 0) && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {/* "new" is real text, so the list says what the map says. */}
            {isNew && <li className="text-xs font-medium leading-[1.4] text-spike">new</li>}
            {/*
              WHY the paper ranked, in the ranker's own words. This is the
              feature that makes a mediocre heuristic usable: a reader who can
              see "case report" or "offline benchmark study" can overrule it
              instantly, and can tell when the ranker is being stupid.
            */}
            {paper.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-[1.4] text-ink-faint">
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* On a phone the score gets its own line, right-aligned like the radar's, rather than a third column that would squeeze the titles. */}
      <p className="tabular col-start-2 mt-2.5 text-right font-mono text-xs leading-[1.3] text-ink-faint sm:col-start-3 sm:row-start-1 sm:mt-[5px]">
        {paper.orderScore}
      </p>
    </article>
  );
}
