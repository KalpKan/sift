import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import SettingsBody from "@/components/me/SettingsBody";
import { getMeContext, pageViewer } from "@/lib/me-context";
import { tapRatings } from "@/lib/me-api";
import { radarInterests } from "@/lib/personal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings — Sift", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const ctx = getMeContext();
  if (!ctx) redirect("/me");
  const viewer = await pageViewer(ctx);
  if (viewer.status === 401) redirect("/sign-in");
  if (viewer.status === 403) redirect("/me");

  const userId = viewer.user.id;
  const [topics, follows, rows, ratings] = await Promise.all([
    ctx.radar.listTopics(),
    ctx.radar.listFollows(userId),
    ctx.radar.listInterests(userId),
    ctx.radar.getRatings(userId),
  ]);
  const followed = new Set(follows);
  const sorted = radarInterests(rows, tapRatings(ratings.values(), rows)).sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  return (
    <MeShell title="Settings" current="settings" subtitle={viewer.user.email ?? undefined}>
      <SettingsBody topics={topics.map((t) => ({ slug: t.slug, name: t.name, followed: followed.has(t.id) }))} interests={sorted} />
    </MeShell>
  );
}
