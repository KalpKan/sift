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
        <p className="py-10 text-sm text-ink-muted">The database is not configured for this deployment.</p>
      </MeShell>
    );
  }

  const viewer = await pageViewer(ctx);
  if (viewer.status === 401) redirect("/sign-in");
  if (viewer.status === 403) {
    return (
      <MeShell title="Private" current="none">
        <p className="mt-8 font-serif text-lg leading-relaxed text-ink-muted">
          This radar belongs to one reader, and you are signed in as someone else. The public feeds are on the{" "}
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-rule-strong">
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
