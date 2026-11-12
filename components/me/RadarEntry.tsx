"use client";

import { useState } from "react";
import { formatDate } from "@/components/PaperEntry";
import { events } from "@/lib/events";
import type { MePaper } from "@/lib/me-api";

type Verdict = 1 | -1;

/**
 * One paper on the private radar: the public entry's typography, plus a
 * thumbs-up and a thumbs-down. A tap is both feedback (it nudges the matched
 * interest terms) and evidence (`npm run eval` scores the rankers on it), so
 * each rating records what rank it was shown at.
 *
 * The open is recorded with `keepalive`, so the request survives the browser
 * leaving for the paper; it never delays the navigation.
 */
export default function RadarEntry({ paper }: { paper: MePaper }) {
  const [verdict, setVerdict] = useState<Verdict | null>(paper.verdict);
  const [failed, setFailed] = useState(false);
  // One rating request at a time per paper: the server keeps one row per
  // paper, so a double tap must not race two upserts.
  const [pending, setPending] = useState(false);
  const href = paper.url ?? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const meta = [paper.authorsShort, paper.journal, formatDate(paper.published)].filter(Boolean).join(" · ");

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
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const button = (v: Verdict, label: string, glyph: string) => (
    <button
      type="button"
      onClick={() => rate(v)}
      disabled={pending}
      aria-pressed={verdict === v}
      aria-label={label}
      title={label}
      className={`px-2 py-1 text-base leading-none transition-opacity ${
        verdict === v ? "opacity-100" : "opacity-40 hover:opacity-80"
      } disabled:cursor-wait`}
    >
      {glyph}
    </button>
  );

  return (
    <article className="grid grid-cols-[2ch_1fr] gap-x-4 py-6 sm:grid-cols-[3ch_1fr_4ch] sm:gap-x-6">
      <span aria-hidden className="tabular pt-1 text-sm text-ink-faint">
        {paper.shownRank}
      </span>

      <div className="min-w-0">
        <h3 className="font-serif text-lg leading-snug sm:text-xl">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={opened}
            className="decoration-rule underline underline-offset-4 transition-colors hover:decoration-rule-strong"
          >
            {paper.title}
          </a>
        </h3>

        {meta && <p className="mt-2 text-sm text-ink-muted">{meta}</p>}

        {paper.reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {paper.reasons.map((reason) => (
              <li key={reason} className="text-xs text-ink-faint">
                {reason}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-1">
          {button(1, "Useful to me", "👍")}
          {button(-1, "Not for me", "👎")}
          {failed && <span className="ml-2 text-xs text-ink-muted">Not saved. Try again.</span>}
        </div>
      </div>

      <p className="tabular hidden pt-1 text-right text-sm text-ink-faint sm:block">{paper.orderScore}</p>
    </article>
  );
}
