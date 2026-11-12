import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FollowsForm from "@/components/me/FollowsForm";
import InterestList from "@/components/me/InterestList";
import MeShell from "@/components/me/MeShell";
import { getMeContext, pageViewer } from "@/lib/me-context";
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
  const sorted = radarInterests(rows, [...ratings.values()]).sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  return (
    <MeShell title="Settings" current="settings" subtitle={viewer.user.email ?? undefined}>
      <section className="mt-12">
        <h2 className="border-b border-rule-strong pb-3 font-serif text-2xl">Topics on your radar</h2>
        <FollowsForm topics={topics.map((t) => ({ slug: t.slug, name: t.name, followed: followed.has(t.id) }))} />
      </section>

      <section className="mt-12">
        <h2 className="border-b border-rule-strong pb-3 font-serif text-2xl">Interests</h2>
        <p className="mt-3 text-sm text-ink-muted">
          Terms that lift a paper on your radar. They are visible only here, only to you.
        </p>
        <InterestList interests={sorted} />
      </section>
    </MeShell>
  );
}
