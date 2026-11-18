import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import RadarEntry from "@/components/me/RadarEntry";
import { DEV_NOW, DEV_RADAR_FEED } from "@/lib/dev-fixtures";
import { isDevPreviewEnabled } from "@/lib/dev-preview";
import { freshness } from "@/lib/page-data";

// Dev preview of /me with fixture data (lib/dev-preview.ts). 404 unless enabled.
// Rating buttons POST to the real /api/me/rate, which answers 401 here, so they
// land in the existing "Not saved" path and never write anything.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dev radar — Sift", robots: { index: false, follow: false } };

export default async function DevRadarPage({ searchParams }: PageProps<"/dev/radar">) {
  if (!isDevPreviewEnabled(process.env)) notFound();
  const { empty } = await searchParams;
  const feed = { ...DEV_RADAR_FEED, papers: empty ? [] : DEV_RADAR_FEED.papers };

  return (
    <MeShell
      title="My radar"
      current="radar"
      subtitle={
        <>
          {feed.query || "No topics followed"} · ranked {freshness(feed.updatedAt, DEV_NOW)} · ranker {feed.rankerVersion}
        </>
      }
    >
      {feed.papers.length > 0 ? (
        <div className="divide-y divide-rule">
          {feed.papers.map((paper) => (
            <RadarEntry key={paper.id} paper={paper} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-sm text-ink-muted">
          Nothing to show yet. Follow a topic in{" "}
          <Link href="/me/settings" className="underline decoration-rule underline-offset-4">
            settings
          </Link>
          , or wait for the morning refresh.
        </p>
      )}

      <p className="mt-2 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
        👍 and 👎 teach the ranking which of your interests matter and grade it against a plain newest-first list,
        on exactly the papers you rated.
      </p>
    </MeShell>
  );
}
