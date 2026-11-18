"use client";

import { useState } from "react";

/**
 * Starts Supabase's Google OAuth flow (the pattern promptflip uses). The
 * redirect is the bare /auth/callback, which is the exact URL on Project B's
 * allow-list; /auth/callback always lands on /me.
 */
export default function GoogleSignInButton() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function signIn() {
    setState("busy");
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={state === "busy"}
        className="border border-rule-strong px-4 py-2 font-serif text-[17px] leading-[1.35] transition-colors hover:bg-surface disabled:opacity-60"
      >
        {state === "busy" ? "Opening Google…" : "Sign in with Google"}
      </button>
      {state === "error" && <p className="mt-3 text-[13px] leading-[1.45] text-ink-muted">Could not reach Google. Try again.</p>}
    </div>
  );
}
