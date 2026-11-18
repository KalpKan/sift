import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FollowsForm from "@/components/me/FollowsForm";
import InterestList from "@/components/me/InterestList";
import MeShell from "@/components/me/MeShell";
import { DEV_INTERESTS, DEV_TOPICS } from "@/lib/dev-fixtures";
import { isDevPreviewEnabled } from "@/lib/dev-preview";

// Dev preview of /me/settings with fixture data. Its writes hit the real API,
// which answers 401 here, so nothing is saved.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dev settings — Sift", robots: { index: false, follow: false } };

export default function DevSettingsPage() {
  if (!isDevPreviewEnabled(process.env)) notFound();

  return (
    <MeShell title="Settings" current="settings" subtitle="reader@example.com">
      <section className="mt-12">
        <h2 className="border-b border-rule-strong pb-3 font-serif text-2xl">Topics on your radar</h2>
        <FollowsForm topics={DEV_TOPICS} />
      </section>

      <section className="mt-12">
        <h2 className="border-b border-rule-strong pb-3 font-serif text-2xl">Interests</h2>
        <p className="mt-3 text-sm text-ink-muted">
          Terms that lift a paper on your radar. They are visible only here, only to you.
        </p>
        <InterestList interests={DEV_INTERESTS} />
      </section>
    </MeShell>
  );
}
