"use client";

/**
 * The firing scheduler (docs/design/brain.md section 6), as a hook.
 *
 * A spike is a 12 px dash that runs down a cell's fibre, one WAAPI animation
 * started by a timer. There is no requestAnimationFrame loop: between events
 * the map has one pending timer, or none when nothing may fire. The scheduler
 * stops and cancels everything when the tab is hidden, when the map is off
 * screen, and under `prefers-reduced-motion: reduce`, where it never starts
 * and the server's steady glow stays.
 *
 * What fires, and when, is decided by lib/brain/firing.ts (pure, tested); this
 * file only touches the DOM the server rendered.
 */

import { useEffect, useRef, type RefObject } from "react";
import {
  BURST_SPEED,
  MAX_DASHES,
  PATTERNS,
  SPIKE_SPEED,
  pickNext,
  spikesFor,
  tripMs,
  type FiringCell,
} from "@/lib/brain/firing";
import { rng, type CellKind, type Variant } from "@/lib/brain/network";

export type FiringApi = {
  /** One spike down this paper's fibre (hover link). Rate-limited, skipped at the dash cap. */
  hoverSpike(id: string): void;
  /** The 👍 burst: three gold dashes, a soma pulse, a gold ring. */
  burst(id: string): void;
  /** Re-read cell states (a rating changed) and start the scheduler if it was idle. */
  refresh(): void;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const DASH_LEN = 12;
const HOVER_GAP_MS = 1200;

type Handle = { cancel(): void };

function canAnimate(el: Element): boolean {
  return typeof (el as Element & { animate?: unknown }).animate === "function";
}

function createEngine(root: HTMLElement, variant: Variant, seed: string): FiringApi & { setRunning(on: boolean): void; destroy(): void } {
  const layer = root.querySelector<SVGGElement>(".brain-spikes");
  const random = rng(seed);
  const dark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastId: string | null = null;
  const lastFiredAt: Record<string, number> = {};
  const hoverAt: Record<string, number> = {};
  const live = new Set<Handle>();

  const cellEls = () => Array.from(root.querySelectorAll<SVGGElement>(".brain-neuron[data-cell]"));
  const findCell = (id: string) => cellEls().find((el) => el.dataset.cell === id || el.dataset.pmid === id);
  const stateOf = (el: SVGGElement): FiringCell => ({
    id: el.dataset.cell ?? "",
    isNew: el.dataset.new === "true",
    verdict: el.dataset.verdict === "1" ? 1 : el.dataset.verdict === "-1" ? -1 : null,
    ghost: el.dataset.ghost === "true",
  });

  /** Dashes currently on screen: one per `live` handle. */
  const dashes = () => live.size;

  function track(el: Element, anims: Animation[]): Handle {
    let done = false;
    const handle: Handle = {
      cancel() {
        if (done) return;
        done = true;
        anims.forEach((a) => a.cancel());
        el.remove();
        live.delete(handle);
      },
    };
    const finish = () => {
      if (done) return;
      done = true;
      el.remove();
      live.delete(handle);
    };
    anims[0].onfinish = finish;
    return handle;
  }

  /** Start one dash on a cell's fibre. Returns its trip time in ms, or null if it could not start. */
  function dash(cell: SVGGElement, tone: "spike" | "up", factor: number, speed: number, delay: number): number | null {
    if (!layer || dashes() >= MAX_DASHES) return null;
    const d = cell.querySelector(".brain-fibre")?.getAttribute("d");
    const len = Number(cell.dataset.len);
    if (!d || !len) return null;
    const g = document.createElementNS(SVG_NS, "g");
    if (!canAnimate(g)) return null;
    const trip = tripMs(len, factor, speed);
    const paths: SVGPathElement[] = [];
    const mk = (cls: string) => {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("class", `${cls} brain-dash-${tone}`);
      p.setAttribute("d", d);
      p.setAttribute("stroke-dasharray", `${DASH_LEN} ${len + DASH_LEN}`);
      p.style.opacity = "0";
      g.appendChild(p);
      paths.push(p);
    };
    if (dark) mk("brain-dash-glow");
    mk("brain-dash");
    const up = Math.min(60 / trip, 0.4);
    const down = Math.max(1 - 100 / trip, 0.6);
    const anims = paths.map((p) =>
      p.animate(
        [
          { opacity: 0, strokeDashoffset: `${DASH_LEN}px` },
          { opacity: 1, offset: up },
          { opacity: 1, offset: down },
          { opacity: 0, strokeDashoffset: `${DASH_LEN - len}px` },
        ],
        { duration: trip, delay, easing: "linear", fill: "both" },
      ),
    );
    layer.appendChild(g);
    live.add(track(g, anims));
    return trip;
  }

  function pulse(cell: SVGGElement, scale: number, ms: number) {
    const soma = cell.querySelector(".brain-soma");
    if (soma && canAnimate(soma)) {
      soma.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], {
        duration: ms,
        easing: "ease-out",
      });
    }
  }

  /** A copy of the new ring grows from rs + 3.5 to rs + 9 while fading. */
  function ringPulse(cell: SVGGElement) {
    const ring = cell.querySelector<SVGCircleElement>(".brain-ring-new");
    if (!ring || !layer) return;
    const copy = ring.cloneNode(false) as SVGCircleElement;
    copy.setAttribute("class", "brain-ring-pulse");
    layer.appendChild(copy);
    if (!canAnimate(copy)) return void copy.remove();
    const r = Number(ring.getAttribute("r")) || 1;
    const a = copy.animate(
      [
        { transform: "scale(1)", opacity: 0.9 },
        { transform: `scale(${(r + 5.5) / r})`, opacity: 0 },
      ],
      { duration: 420, easing: "ease-out", fill: "both" },
    );
    a.onfinish = () => copy.remove();
  }

  function cancelAll() {
    for (const h of Array.from(live)) h.cancel();
    layer?.replaceChildren();
  }

  /** Run one ambient event. Returns when it ends (ms), or null if it could not start. */
  function runEvent(id: string): number | null {
    const cell = findCell(id);
    if (!cell) return null;
    const kind = (cell.dataset.kind ?? "pyramidal") as CellKind;
    const n = spikesFor(variant, kind);
    if (dashes() + n > MAX_DASHES) return null;
    const pat = PATTERNS[kind];
    let end = 0;
    for (let i = 0; i < n; i++) {
      const trip = dash(cell, "spike", pat.speed, SPIKE_SPEED, i * pat.gapMs);
      if (trip === null) return null;
      end = Math.max(end, i * pat.gapMs + trip);
    }
    pulse(cell, 1.3, 260);
    ringPulse(cell);
    return end;
  }

  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (!running) return;
    const next = pickNext({ cells: cellEls().map(stateOf), variant, lastId, lastFiredAt, now: Date.now(), rng: random });
    // Nothing may fire: stay idle with no timer until a rating changes (refresh).
    if (!next) return;
    timer = setTimeout(() => {
      const end = runEvent(next.id);
      if (end === null) {
        timer = setTimeout(schedule, 1000);
        return;
      }
      lastId = next.id;
      lastFiredAt[next.id] = Date.now();
      timer = setTimeout(schedule, end);
    }, next.delayMs);
  }

  return {
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) schedule();
      else {
        clearTimeout(timer);
        timer = undefined;
        cancelAll();
      }
    },
    hoverSpike(id) {
      if (!running) return;
      const cell = findCell(id);
      if (!cell) return;
      const s = stateOf(cell);
      if (s.ghost || s.verdict === -1) return;
      const now = Date.now();
      if (now - (hoverAt[id] ?? -Infinity) < HOVER_GAP_MS || dashes() >= MAX_DASHES) return;
      if (dash(cell, "spike", 1, SPIKE_SPEED, 0) !== null) hoverAt[id] = now;
    },
    burst(id) {
      if (!running) return;
      const cell = findCell(id);
      if (!cell) return;
      // The burst needs all three dashes: it cancels ambient ones.
      clearTimeout(timer);
      cancelAll();
      let end = 0;
      for (let i = 0; i < 3; i++) {
        const trip = dash(cell, "up", 1, BURST_SPEED, i * 90);
        if (trip !== null) end = Math.max(end, i * 90 + trip);
      }
      pulse(cell, 1.45, 320);
      const ring = cell.querySelector(cell.dataset.new === "true" ? ".brain-ring-up-far" : ".brain-ring-up-near");
      if (ring && canAnimate(ring)) {
        ring.animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], { duration: 240, easing: "ease-out" });
      }
      timer = setTimeout(schedule, end);
    },
    refresh() {
      if (running && timer === undefined) schedule();
    },
    destroy() {
      clearTimeout(timer);
      cancelAll();
    },
  };
}

/**
 * Start firing on the map under `ref`. Returns a ref to the hover and burst
 * calls (null until mounted, and for a dormant map).
 */
export function useFiring(
  ref: RefObject<HTMLElement | null>,
  { variant, seed, enabled }: { variant: Variant; seed: string; enabled: boolean },
): RefObject<FiringApi | null> {
  const api = useRef<FiringApi | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const engine = createEngine(root, variant, seed);
    api.current = engine;

    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    let reduced = mq?.matches ?? false;
    let visible = typeof IntersectionObserver === "undefined";

    const sync = () => {
      // The glow disc is hidden once the scheduler owns the map, and shown again if motion is switched off.
      root.classList.toggle("is-live", !reduced);
      engine.setRunning(!reduced && visible && !document.hidden);
    };
    const onMotion = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      sync();
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries[entries.length - 1].isIntersecting;
              sync();
            },
            { threshold: 0.15 },
          );
    io?.observe(root);
    mq?.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      io?.disconnect();
      mq?.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", sync);
      engine.destroy();
      root.classList.remove("is-live");
      api.current = null;
    };
  }, [ref, variant, seed, enabled]);

  return api;
}
