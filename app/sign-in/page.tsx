import type { Metadata } from "next";
import Link from "next/link";
import BrainMaps from "@/components/brain/BrainMaps";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/me/GoogleSignInButton";
import { appName } from "@/lib/env";
import { motifModel } from "@/lib/brain/public-model";

export const metadata: Metadata = { title: "Sign in — Sift", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  const motif = motifModel();
  const link = "underline decoration-ink-faint underline-offset-4 hover:decoration-ink";
  return (
    // ph-no-capture: never autocaptured or replayed (lib/posthog-privacy.ts).
    <div className="ph-no-capture flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-8 sm:px-8 sm:pt-12">
        <p className="text-xs leading-[1.4] text-ink-faint">
          <Link href="/" className={link}>
            Sift
          </Link>
        </p>
        <header className="mt-5 border-b border-rule-strong pb-4">
          <h1 className="font-serif text-[28px] leading-[1.15] tracking-[-0.01em] sm:text-[34px] sm:leading-[1.1]">Sign in</h1>
        </header>
        <p className="mt-8 font-serif text-[18px] leading-[1.55] text-ink-muted sm:text-[19px] sm:leading-[1.6]">
          The radar is a private feed for one reader. The public feeds need no account and are on the{" "}
          <Link href="/" className={link}>
            front page
          </Link>
          .
        </p>
        {/* The motif's hub sits on its bottom edge, so the cell's fibre runs straight into the button. */}
        <div className="mt-8">
          <div className="w-[200px]">
            <BrainMaps variant="motif" clusters={motif.clusters} neurons={motif.neurons} />
          </div>
          <GoogleSignInButton />
          {error && <p className="mt-4 text-[13px] leading-[1.45] text-ink-muted">That sign-in did not complete. Try again.</p>}
        </div>
      </main>
      <Footer service={appName()} />
    </div>
  );
}
