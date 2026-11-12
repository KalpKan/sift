"use client";

import { useState } from "react";

type Row = { term: string; weight: number; source: "obsidian" | "taps" | "manual" };

const SOURCE: Record<Row["source"], string> = {
  obsidian: "from Obsidian",
  taps: "learned from your taps",
  manual: "added by hand",
};

/**
 * Every interest, Obsidian and hand-typed rows deletable (docs/obsidian-bridge.md,
 * rule 4); deleting one also forgets what taps taught it. Tap weights are
 * derived from ratings, so they change by re-rating, not deleting. This page is
 * the only place interests are ever rendered.
 */
export default function InterestList({ interests }: { interests: Row[] }) {
  const [rows, setRows] = useState(interests);
  const [error, setError] = useState(false);

  async function remove(row: Row) {
    setError(false);
    const res = await fetch("/api/me/interests", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: row.term, source: row.source }),
    }).catch(() => null);
    if (res && (res.ok || res.status === 404)) {
      setRows((rs) => rs.filter((r) => !(r.term === row.term && r.source === row.source)));
    } else {
      setError(true);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-ink-muted">
        No interests yet. Run the Obsidian bridge on your Mac (docs/obsidian-bridge.md), or rate papers on the radar.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-rule">
        {rows.map((r) => (
          <li key={`${r.term}:${r.source}`} className="flex items-baseline justify-between gap-4 py-3">
            <span>
              <span className="font-serif text-lg">{r.term}</span>{" "}
              <span className="text-xs text-ink-faint">
                {SOURCE[r.source]} · <span className="tabular">{r.weight > 0 ? "+" : ""}{r.weight.toFixed(2)}</span>
              </span>
            </span>
            {r.source === "taps" ? (
              <span className="text-xs text-ink-faint">re-rate to change</span>
            ) : (
            <button
              type="button"
              onClick={() => remove(r)}
              className="text-xs text-ink-muted underline decoration-rule underline-offset-4 hover:decoration-rule-strong"
              aria-label={`Delete ${r.term} (${SOURCE[r.source]})`}
            >
              Delete
            </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-ink-muted">Could not delete. Try again.</p>}
    </div>
  );
}
