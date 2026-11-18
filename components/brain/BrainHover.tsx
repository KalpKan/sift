"use client";

/**
 * The link between the list and the map. One provider wraps both.
 *
 * - `active`: the paper (PMID) being hovered or focused, from a row or a cell.
 *   `from` says which, so a row only draws its highlight when the cell was
 *   the source.
 * - `verdicts`: a rating the reader has just set or rolled back. The server
 *   render carries the saved verdict; this overrides it, so a failed 👍
 *   returns the map to what it showed before (Review Focus 3).
 * - `burst`: set only by an optimistic 👍 that was not already 👍, never by a
 *   rollback and never on load.
 *
 * Without a provider every call is a no-op, so a row or a map renders alone.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Verdict = 1 | -1 | null;
type ActiveFrom = "row" | "cell";

export type BrainHoverValue = {
  active: string | null;
  from: ActiveFrom | null;
  setActive(id: string | null, from?: ActiveFrom): void;
  /** Keep a row highlighted for 1.6 s after a cell was clicked. */
  flash(id: string): void;
  verdicts: Record<string, Verdict>;
  setVerdict(pmid: string, verdict: Verdict, opts?: { burst?: boolean }): void;
  burst: { pmid: string; seq: number } | null;
};

const NOOP: BrainHoverValue = {
  active: null,
  from: null,
  setActive() {},
  flash() {},
  verdicts: {},
  setVerdict() {},
  burst: null,
};

const BrainHoverContext = createContext<BrainHoverValue>(NOOP);

export const FLASH_MS = 1600;

export function BrainHoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ active: string | null; from: ActiveFrom | null }>({ active: null, from: null });
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [burst, setBurst] = useState<BrainHoverValue["burst"]>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // True while a clicked cell's row is being held lit: a hover must not cut it short.
  const flashing = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const setActive = useCallback((id: string | null, from: ActiveFrom = "row") => {
    // The page scrolls under a still pointer after a click, which fires hovers on other rows: ignore them.
    if (flashing.current) return;
    clearTimeout(timer.current);
    setState(id === null ? { active: null, from: null } : { active: id, from });
  }, []);

  const flash = useCallback((id: string) => {
    clearTimeout(timer.current);
    flashing.current = true;
    setState({ active: id, from: "cell" });
    timer.current = setTimeout(() => {
      flashing.current = false;
      setState({ active: null, from: null });
    }, FLASH_MS);
  }, []);

  const setVerdict = useCallback((pmid: string, verdict: Verdict, opts?: { burst?: boolean }) => {
    setVerdicts((v) => ({ ...v, [pmid]: verdict }));
    if (opts?.burst) setBurst({ pmid, seq: ++seq.current });
  }, []);

  const value = useMemo<BrainHoverValue>(
    () => ({ active: state.active, from: state.from, setActive, flash, verdicts, setVerdict, burst }),
    [state, setActive, flash, verdicts, setVerdict, burst],
  );
  return <BrainHoverContext.Provider value={value}>{children}</BrainHoverContext.Provider>;
}

export function useBrainHover(): BrainHoverValue {
  return useContext(BrainHoverContext);
}
