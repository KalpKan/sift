import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeShell from "@/components/me/MeShell";
import SettingsBody from "@/components/me/SettingsBody";
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
      <SettingsBody topics={DEV_TOPICS} interests={DEV_INTERESTS} />
    </MeShell>
  );
}
