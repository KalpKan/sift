"use client";

import { useState, type CSSProperties } from "react";
import { useBrainHover } from "@/components/brain/BrainHover";
import { dotClass } from "@/components/brain/rowDot";
import { MetaLine, reasonText } from "@/components/PaperEntry";
import { events } from "@/lib/events";
import type { MePaper } from "@/lib/me-api";

type Verdict = 1 | -1;

/**
 * One paper on the private radar (docs/design/brain.md section 7): rank and a
 * dot in its field's hue, the title as the largest and darkest thing, meta,
 * reasons led by the word "new", and a thumbs-up and a thumbs-down. A tap is
 * both feedback (it nudges the matched interest terms) and evidence
 * (`npm run eval` scores the rankers on it), so each rating records what rank
 * it was shown at.
 *
 * The row and the map's cell are two views of one paper. Hovering or focusing
 * the row lights the cell; the rating shows on the cell at once, and goes back
 * with the button if the request fails.
 *
 * `hue` is the field's index (0-3, the cluster colour), `isNew` is decided by
 * the page on the server so the markup never depends on the clock.
 *
 * The open is recorded with `keepalive`, so the request survives the browser
 * leaving for the paper; it never delays the navigation.
 */
export default function RadarEntry({
  paper,
  hue = 0,
  isNew = false,
  topicName,
}: {
  paper: MePaper;
  hue?: number;
  isNew?: boolean;
  topicName?: string;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(paper.verdict);
  const [failed, setFailed] = useState(false);
  // One rating request at a time per paper: the server keeps one row per
  // paper, so a double tap must not race two upserts.
  const [pending, setPending] = useState(false);
  const brain = useBrainHover();
  const href = paper.url ?? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const litFromCell = brain.active === paper.pmid && brain.from === "cell";

  function opened() {
    events.radar_paper_opened({ pmid: paper.pmid });
    void fetch("/api/me/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pmid: paper.pmid, surface: "web" }),
      keepalive: true,
    }).catch(() => {});
  }

  async function rate(next: Verdict) {
    if (pending) return;
    const before = verdict;
    setPending(true);
    setVerdict(next);
    // The map shows it now; a 👍 that was not already 👍 sends a burst.
    brain.setVerdict(paper.pmid, next, { burst: next === 1 && before !== 1 });
    setFailed(false);
    try {
      const res = await fetch("/api/me/rate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pmid: paper.pmid,
          verdict: next,
          surface: "web",
          shownRank: paper.shownRank,
          recencyRank: paper.recencyRank,
          rankerVersion: paper.rankerVersion,
          topic: paper.topic,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      events.paper_rated({ pmid: paper.pmid, verdict: next });
    } catch {
      setVerdict(before);
      brain.setVerdict(paper.pmid, before);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const pressed = {
    1: "border-reinforce bg-reinforce-wash",
    "-1": "border-ink-muted bg-surface-strong",
  } as const;

  const button = (v: Verdict, label: string, glyph: string) => (
    <button
      type="button"
      onClick={() => rate(v)}
      disabled={pending}
      aria-pressed={verdict === v}
      aria-label={label}
      title={label}
      className={`group h-10 w-11 rounded-[4px] border text-[15px] leading-none disabled:cursor-wait disabled:opacity-60 sm:h-8 sm:w-9 ${
        verdict === v ? pressed[v] : "border-control bg-transparent hover:border-ink-faint hover:bg-surface"
      }`}
    >
      <span className={verdict === v ? "" : "rate-glyph"}>{glyph}</span>
    </button>
  );

  const dot = dotClass(verdict, isNew);

  const active = () => brain.setActive(paper.pmid, "row");
  const inactive = () => brain.active === paper.pmid && brain.from === "row" && brain.setActive(null);

  return (
    <article
      id={`paper-${paper.pmid}`}
      style={{ "--c": `var(--cluster-${(hue % 4) + 1})` } as CSSProperties}
      onPointerEnter={active}
      onPointerLeave={inactive}
      onFocus={active}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) inactive();
      }}
      className={`grid scroll-mt-6 grid-cols-[28px_minmax(0,1fr)] gap-x-[10px] py-[18px] sm:grid-cols-[44px_minmax(0,1fr)_88px] sm:gap-x-3 sm:py-5 ${
        litFromCell ? "bg-surface shadow-[-12px_0_0_var(--surface),12px_0_0_var(--surface)]" : ""
      }`}
    >
      <div aria-hidden className="flex w-[2ch] flex-col items-end gap-[7px] pt-[5px] font-mono text-xs sm:w-auto sm:flex-row sm:items-baseline sm:gap-[10px]">
        <span className="tabular inline-block w-[2ch] text-right leading-[1.3] text-ink-faint">{paper.shownRank}</span>
        <span className={`inline-block size-2 flex-none rounded-full sm:-translate-y-px ${dot}`} />
      </div>

      <div className="min-w-0">
        <h3 className="font-serif text-[18px] leading-[1.32] sm:text-[20px] sm:leading-[1.3]">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={opened}
            className="[overflow-wrap:anywhere] decoration-ink decoration-1 underline-offset-4 hover:underline focus-visible:underline"
          >
            {paper.title}
          </a>
        </h3>

        <MetaLine authors={paper.authorsShort} journal={paper.journal} published={paper.published} topicName={topicName} />

        {(isNew || paper.reasons.length > 0) && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {isNew && <li className="text-xs font-medium leading-[1.4] text-spike">new</li>}
            {paper.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-[1.4] text-ink-faint">
                {reasonText(reason)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="col-start-2 mt-2.5 flex items-center justify-between sm:col-start-3 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-end">
          <div className="flex gap-1.5">
            {button(1, "Useful to me", "👍")}
            {button(-1, "Not for me", "👎")}
          </div>
          {failed && <span className="text-xs text-ink-muted">Not saved. Try again.</span>}
        </div>
        <p className="tabular font-mono text-xs leading-[1.3] text-ink-faint">{paper.orderScore}</p>
      </div>
    </article>
  );
}
