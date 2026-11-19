"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Variant } from "@/lib/brain/network";
import { useBrainHover } from "./BrainHover";
import { useFiring } from "./useFiring";

/**
 * The client shell around a server-rendered map: it adds firing, the row link
 * and the click-to-scroll. It owns the root element (`aria-hidden`, fixed
 * height, so nothing shifts before hydration) and flips data attributes on the
 * SVG the server drew; CSS in app/globals.css turns those into states.
 */
export default function BrainFrame({
  variant,
  layout,
  height,
  seed,
  dormant,
  children,
}: {
  variant: Variant;
  layout: "wide" | "compact";
  height: number;
  seed: string;
  dormant: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useFiring(ref, { variant, seed, enabled: !dormant });
  const { active, from, setActive, flash, verdicts, burst } = useBrainHover();
  const linked = variant === "radar";

  // A rating set or rolled back in the list shows on the cell, instantly.
  useEffect(() => {
    const root = ref.current;
    if (!root || !linked) return;
    root.querySelectorAll<SVGGElement>("[data-pmid]").forEach((el) => {
      const v = verdicts[el.dataset.pmid ?? ""];
      if (v === undefined) return;
      if (v === null) el.removeAttribute("data-verdict");
      else el.setAttribute("data-verdict", String(v));
    });
    api.current?.refresh();
  }, [verdicts, linked, api]);

  // The hovered or focused paper lights its cell and its field label, and sends one spike.
  useEffect(() => {
    const root = ref.current;
    if (!root || !linked) return;
    root.querySelectorAll("[data-hl]").forEach((el) => el.removeAttribute("data-hl"));
    root.classList.remove("is-hover");
    if (!active) return;
    const cell = Array.from(root.querySelectorAll<SVGGElement>("[data-pmid]")).find((el) => el.dataset.pmid === active);
    if (!cell) return;
    cell.setAttribute("data-hl", "true");
    const cluster = cell.dataset.cluster;
    root.querySelectorAll<SVGTextElement>(".brain-label").forEach((el) => {
      if (el.dataset.cluster === cluster) el.setAttribute("data-hl", "true");
    });
    root.classList.add("is-hover");
    api.current?.hoverSpike(active);
  }, [active, from, linked, api]);

  // An optimistic 👍 sends a burst; a rollback or a reload never does.
  useEffect(() => {
    if (burst) api.current?.burst(burst.pmid);
  }, [burst, api]);

  const pmidAt = (target: EventTarget) =>
    (target as Element).closest?.("[data-pmid]")?.getAttribute("data-pmid") ?? null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`brain brain-${variant}${dormant ? " is-dormant" : ""}`}
      data-layout={layout}
      style={{ height }}
      onPointerOver={
        linked
          ? (e) => {
              const id = pmidAt(e.target);
              if (id) setActive(id, "cell");
              else if (from === "cell") setActive(null);
            }
          : undefined
      }
      onPointerLeave={linked ? () => from === "cell" && setActive(null) : undefined}
      onClick={
        linked
          ? (e) => {
              const id = pmidAt(e.target);
              if (!id) return;
              const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
              document.getElementById(`paper-${id}`)?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
              flash(id);
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
