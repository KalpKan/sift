"use client";

import { events } from "@/lib/events";

/**
 * The paper title, as a link that reports having been opened.
 *
 * This is a client component only so the click can be recorded; everything
 * else about an entry stays on the server. `track` is a silent no-op without
 * NEXT_PUBLIC_POSTHOG_KEY, so this works unchanged with analytics off.
 *
 * The event fires on click and the browser then follows the link normally —
 * there is no preventDefault and no wait on the network, because a paper
 * failing to open in order to record that it opened would be absurd.
 */
export default function PaperLink({
  href,
  topic,
  rank,
  className,
  children,
}: {
  href: string;
  topic: string;
  rank: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => events.paper_opened({ topic, rank })}
    >
      {children}
    </a>
  );
}
