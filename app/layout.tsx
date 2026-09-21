import type { Metadata } from "next";
import "./globals.css";
import PostHogProvider from "@/components/PostHogProvider";

// System font stack on purpose: no network fetch at build time, nothing to
// self-host, no layout shift — and the OS serif is a better book face at this
// size than anything a CDN would send. The stacks live in app/globals.css.
export const metadata: Metadata = {
  title: { default: "Sift", template: "%s" },
  description: "The newest important papers in your field, on your Lock Screen.",
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
