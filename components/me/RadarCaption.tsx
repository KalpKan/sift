"use client";

import { useBrainHover } from "@/components/brain/BrainHover";

type Verdict = 1 | -1 | null;

const Ring = ({ tone }: { tone: "spike" | "reinforce" }) => (
  <span
    aria-hidden
    className={`mr-1.5 inline-block size-[7px] rounded-full border-[1.25px] align-[-0.5px] ${
      tone === "spike" ? "border-spike" : "border-reinforce"
    }`}
  />
);

/**
 * The radar figure's caption: "10 papers  o 3 new in 48 h  o 1 marked useful".
 * Counts that are zero drop out. The "marked useful" count follows the ratings
 * made on this page, so it agrees with the map the moment a thumb is tapped.
 */
export default function RadarCaption({
  fieldCount,
  papers,
  newCount,
}: {
  fieldCount: number;
  papers: { pmid: string; verdict: Verdict }[];
  newCount: number;
}) {
  const { verdicts } = useBrainHover();
  if (fieldCount === 0) return <span>No fields followed</span>;
  if (papers.length === 0) return <span>No papers today</span>;
  const useful = papers.filter((p) => (p.pmid in verdicts ? verdicts[p.pmid] : p.verdict) === 1).length;
  return (
    <>
      <span>
        {papers.length} paper{papers.length === 1 ? "" : "s"}
      </span>
      {newCount > 0 && (
        <span>
          <Ring tone="spike" />
          {newCount} new in 48 h
        </span>
      )}
      {useful > 0 && (
        <span>
          <Ring tone="reinforce" />
          {useful} marked useful
        </span>
      )}
    </>
  );
}
