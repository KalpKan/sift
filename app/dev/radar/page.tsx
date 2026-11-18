import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import RadarView, { radarSubtitle } from "@/components/me/RadarView";
import { DEV_FIELDS, DEV_NOW, DEV_RADAR_FEED } from "@/lib/dev-fixtures";
import { isDevPreviewEnabled } from "@/lib/dev-preview";

// Dev preview of /me with fixture data (lib/dev-preview.ts). 404 unless enabled.
// Rating buttons POST to the real /api/me/rate, which answers 401 here, so they
// land in the existing "Not saved" path and never write anything.
// ?empty=1 gives no papers, ?nofields=1 gives no followed fields (the dormant map).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dev radar — Sift", robots: { index: false, follow: false } };

export default async function DevRadarPage({ searchParams }: PageProps<"/dev/radar">) {
  if (!isDevPreviewEnabled(process.env)) notFound();
  const { empty, nofields } = await searchParams;
  const fields = nofields ? [] : DEV_FIELDS;
  const papers = empty || nofields ? [] : DEV_RADAR_FEED.papers;

  return (
    <MeShell
      title="My radar"
      current="radar"
      subtitle={radarSubtitle(fields.length, DEV_RADAR_FEED.updatedAt, DEV_NOW, DEV_RADAR_FEED.rankerVersion)}
    >
      <RadarView fields={fields} papers={papers} now={DEV_NOW} />
    </MeShell>
  );
}
