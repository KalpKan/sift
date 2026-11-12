import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/me/GoogleSignInButton";
import { appName } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in — Sift", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs tracking-wide text-ink-faint">
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-rule-strong">
            Sift
          </Link>
        </p>
        <header className="mt-6 border-b border-rule-strong pb-4">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Sign in</h1>
        </header>
        <p className="mt-8 font-serif text-lg leading-relaxed text-ink-muted">
          The radar is a private feed for one reader. The public feeds need no account and are on the{" "}
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-rule-strong">
            front page
          </Link>
          .
        </p>
        <div className="mt-10">
          <GoogleSignInButton />
          {error && <p className="mt-4 text-sm text-ink-muted">That sign-in did not complete. Try again.</p>}
        </div>
      </main>
      <Footer service={appName()} />
    </div>
  );
}
