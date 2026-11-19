import type { ReactNode } from "react";

/**
 * A map as a figure in a paper: the maps between a strong rule (omit it with
 * `topRule={false}` when the page header's rule is already there) and a
 * hairline, then a one-line mono caption, then a hairline. Not a card and not
 * a background; nothing is drawn behind text.
 */
export default function BrainFigure({
  children,
  caption,
  topRule = true,
}: {
  children: ReactNode;
  caption: ReactNode;
  topRule?: boolean;
}) {
  return (
    <figure className={topRule ? "border-t border-rule-strong" : undefined}>
      {children}
      <figcaption className="flex flex-wrap items-center gap-x-[14px] gap-y-1 border-y border-rule pb-2 pt-1.5 font-mono text-[11px] leading-[1.3] text-ink-faint">
        {caption}
      </figcaption>
    </figure>
  );
}
