import { Fragment, type CSSProperties, type ReactNode } from "react";
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
 * A stored reason as it is shown. The ranker words an age as "1 weeks old",
 * "1 days old" or "1 months old"; the row shows those in the singular. This is
 * display only: the stored reason, the API and lib/ranking.ts are untouched,
 * and no reason is dropped or merged. "11 weeks old" and "21 days old" stay.
 */
export function reasonText(reason: string): string {
  return reason.replace(/(?<![\d.])1 (weeks|days|months) old\b/g, (_m, unit: string) => `1 ${unit.slice(0, -1)} old`);
}

/**
 * The meta line of a row (docs/design/brain.md section 7), shared by the public and the private row: authors,
 * journal, date and, on the radar, the field. The date is one `white-space: nowrap` run, so it never splits as
 * "17 / Nov 2026". Every " · " belongs to the item before it, joined by a non-breaking space, so a line can
 * end with a dot but never starts with one. Authors and journal still wrap freely.
 */
export function MetaLine({
  authors,
  journal,
  published,
  topicName,
}: {
  authors?: string | null;
  journal?: string | null;
  published: string;
  topicName?: string;
}) {
  const date = formatDate(published);
  const items: ReactNode[] = [
    authors,
    journal,
    date && <span className="whitespace-nowrap">{date}</span>,
    topicName && <span className="whitespace-nowrap font-medium text-[var(--c)]">{topicName}</span>,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <p className="mt-1.5 text-[13px] leading-[1.45] text-ink-muted [overflow-wrap:anywhere]">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          {item}
          {i < items.length - 1 && "\u00A0·"}
        </Fragment>
      ))}
    </p>
  );
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
  const hasReasons = isNew || paper.reasons.length > 0;

  return (
    <article
      style={{ "--c": `var(--cluster-${(hue % 4) + 1})` } as CSSProperties}
      className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-[10px] py-[18px] sm:grid-cols-[44px_minmax(0,1fr)_88px] sm:gap-x-3 sm:py-5"
    >
      <div className="flex w-[2ch] flex-col items-end gap-[7px] pt-[5px] font-mono text-xs sm:w-auto sm:flex-row sm:items-baseline sm:gap-[10px]">
        <span aria-hidden className="tabular inline-block w-[2ch] text-right leading-[1.3] text-ink-faint">
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

        <MetaLine authors={paper.authorsShort} journal={paper.journal} published={paper.published} />

        {/*
          The score. Under 640 px it floats to the right end of the first reasons line, so it does not take a
          line of its own (a row with no reasons keeps one). From 640 px it sits at the top of the third column.
          It comes before the reasons so the float is there when the first line is laid out.
        */}
        <p
          className={`tabular font-mono text-xs leading-[1.4] text-ink-faint sm:absolute sm:right-0 sm:top-[25px] sm:float-none sm:m-0 sm:w-[88px] sm:text-right sm:leading-[1.3] ${
            hasReasons ? "float-right mt-1.5 pl-3" : "mt-2.5 text-right"
          }`}
        >
          {paper.orderScore}
        </p>

        {hasReasons && (
          <ul className="-mb-1 mt-1.5">
            {/* "new" is real text, so the list says what the map says. */}
            {isNew && <li className="mb-1 mr-3 inline-block text-xs font-medium leading-[1.4] text-spike">new</li>}
            {/*
              WHY the paper ranked, in the ranker's own words. This is the
              feature that makes a mediocre heuristic usable: a reader who can
              see "case report" or "offline benchmark study" can overrule it
              instantly, and can tell when the ranker is being stupid.
            */}
            {paper.reasons.map((reason) => (
              <li key={reason} className="mb-1 mr-3 inline-block align-baseline text-xs leading-[1.4] text-ink-faint">
                {reasonText(reason)}
              </li>
            ))}
          </ul>
        )}
      </div>

    </article>
  );
}
