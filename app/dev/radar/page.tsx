import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import RadarView, { radarSubtitle } from "@/components/me/RadarView";
import { DEV_NOW, DEV_RADAR_FEED, devRadarVariant } from "@/lib/dev-fixtures";
import { isDevPreviewEnabled } from "@/lib/dev-preview";

// Dev preview of /me with fixture data (lib/dev-preview.ts). 404 unless enabled.
// Rating buttons POST to the real /api/me/rate, which answers 401 here, so they
// land in the existing "Not saved" path and never write anything.
// ?empty=1 gives no papers, ?nofields=1 gives no followed fields (the dormant map).
// ?fields=1 puts all ten papers in one field; ?fields=6 follows six fields, one with no paper.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dev radar — Sift", robots: { index: false, follow: false } };

export default async function DevRadarPage({ searchParams }: PageProps<"/dev/radar">) {
  if (!isDevPreviewEnabled(process.env)) notFound();
  const { empty, nofields, fields: fieldCount } = await searchParams;
  const variant = devRadarVariant(fieldCount);
  const fields = nofields ? [] : variant.fields;
  const papers = empty || nofields ? [] : variant.papers;

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
