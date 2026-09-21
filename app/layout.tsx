import type { Metadata } from "next";
import "./globals.css";
import PostHogProvider from "@/components/PostHogProvider";
import { appName } from "@/lib/env";

// System font stack on purpose: no network fetch at build time, nothing to
// self-host. Swap in next/font/local when the app gets its own design.
export const metadata: Metadata = {
  title: appName(),
  description: `${appName()} — part of kalpkan.com`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
