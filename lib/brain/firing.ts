/**
 * When and how a cell fires: the pure half of the motion rules in
 * docs/design/brain.md section 6. The DOM half is components/brain/useFiring.ts.
 */

import type { CellKind, Variant } from "./network";

/** The most dashes a map may show at once. A Purkinje event uses all three. */
export const MAX_DASHES = 3;
/** Dash travel speed in px/s. */
export const SPIKE_SPEED = 170;
/** Burst (👍) travel speed in px/s. */
export const BURST_SPEED = 220;
/** A cell rests this long between its own events. */
export const CELL_REST_MS = 8000;

export const PATTERNS: Record<CellKind, { spikes: number; gapMs: number; speed: number }> = {
  pyramidal: { spikes: 1, gapMs: 0, speed: 1 }, // regular spiking
  stellate: { spikes: 2, gapMs: 140, speed: 1 }, // fast spiking
  purkinje: { spikes: 3, gapMs: 110, speed: 1 }, // complex spike
  bipolar: { spikes: 1, gapMs: 0, speed: 0.7 }, // slow
};

/** Spikes in one event. The motif always fires a single spike. */
export function spikesFor(variant: Variant, kind: CellKind): number {
  return variant === "motif" ? 1 : PATTERNS[kind].spikes;
}

/** Time for a dash to run `len` px, clamped to 380-900 ms. `factor` slows a cell, `speed` is px/s. */
export function tripMs(len: number, factor = 1, speed = SPIKE_SPEED): number {
  return Math.min(900, Math.max(380, (len / (speed * factor)) * 1000));
}

/** Rest between events, in ms: [min, max]. */
export function restRange(variant: Variant): [number, number] {
  if (variant === "hero") return [4000, 9000];
  if (variant === "motif") return [6000, 10000];
  return [3000, 7000];
}

export type FiringCell = { id: string; isNew: boolean; verdict: 1 | -1 | null; ghost: boolean };

/**
 * The next event: which cell and how long to wait. Null when nothing may fire.
 *
 * Radar and topic: only new cells that are not 👎, so a firing cell is always
 * a claim about data. Hero and motif: any cell that is not a ghost. A cell
 * rests 8 s after its own last event, and never fires twice in a row while
 * another candidate exists.
 */
export function pickNext(args: {
  cells: FiringCell[];
  variant: Variant;
  lastId: string | null;
  lastFiredAt: Record<string, number>;
  now: number;
  rng: () => number;
}): { id: string; delayMs: number } | null {
  const { cells, variant, lastId, lastFiredAt, now, rng } = args;
  const ambient = variant === "hero" || variant === "motif";
  let pool = cells.filter((c) => !c.ghost && c.verdict !== -1 && (ambient || c.isNew));
  if (pool.length === 0) return null;
  if (pool.length > 1) pool = pool.filter((c) => c.id !== lastId);
  const pick = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const [lo, hi] = restRange(variant);
  const rest = lo + rng() * (hi - lo);
  const ready = (lastFiredAt[pick.id] ?? -Infinity) + CELL_REST_MS - now;
  return { id: pick.id, delayMs: Math.max(rest, ready) };
}
