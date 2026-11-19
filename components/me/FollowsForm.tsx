"use client";

import { useState } from "react";

type Row = { slug: string; name: string; followed: boolean };

/** Which topics feed the radar. Saves the whole set with PUT /api/me/follows. */
export default function FollowsForm({ topics }: { topics: Row[] }) {
  const [rows, setRows] = useState(topics);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function toggle(slug: string) {
    const next = rows.map((r) => (r.slug === slug ? { ...r, followed: !r.followed } : r));
    setRows(next);
    setState("saving");
    try {
      const res = await fetch("/api/me/follows", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slugs: next.filter((r) => r.followed).map((r) => r.slug) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("saved");
    } catch {
      setRows(rows);
      setState("error");
    }
  }

  return (
    <div>
      <ul className="divide-y divide-rule">
        {rows.map((r) => (
          <li key={r.slug} className="py-[14px]">
            <label className="flex cursor-pointer items-baseline gap-3 font-serif text-[17px] leading-[1.35]">
              <input type="checkbox" checked={r.followed} onChange={() => toggle(r.slug)} className="follow-check translate-y-0.5" />
              {r.name}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 h-4 text-xs leading-[1.4] text-ink-faint" aria-live="polite">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved." : state === "error" ? "Not saved. Try again." : ""}
      </p>
    </div>
  );
}
