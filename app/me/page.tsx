import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import RadarView, { radarSubtitle } from "@/components/me/RadarView";
import { buildMe } from "@/lib/me-api";
import { getMeContext, pageViewer } from "@/lib/me-context";

// Personal and signed-in: never prerendered, never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My radar — Sift", robots: { index: false, follow: false } };

const LIMIT = 10;

export default async function RadarPage() {
  const ctx = getMeContext();
  if (!ctx) {
    return (
      <MeShell title="My radar" current="none" signedIn={false}>
        <p className="py-10 text-[13px] leading-[1.45] text-ink-muted">The database is not configured for this deployment.</p>
      </MeShell>
    );
  }

  const viewer = await pageViewer(ctx);
  if (viewer.status === 401) redirect("/sign-in");
  if (viewer.status === 403) {
    return (
      <MeShell title="Private" current="none">
        <p className="mt-8 font-serif text-[18px] leading-[1.55] text-ink-muted sm:text-[19px] sm:leading-[1.6]">
          This radar belongs to one reader, and you are signed in as someone else. The public feeds are on the{" "}
          <Link href="/" className="underline decoration-ink-faint underline-offset-4 hover:decoration-ink">
            front page
          </Link>
          .
        </p>
      </MeShell>
    );
  }

  const { feed, fields } = await buildMe(ctx, viewer.user.id, LIMIT);
  const now = new Date();

  return (
    <MeShell title="My radar" current="radar" subtitle={radarSubtitle(fields.length, feed.updatedAt, now, feed.rankerVersion)}>
      <RadarView fields={fields} papers={feed.papers} now={now} />
    </MeShell>
  );
}
