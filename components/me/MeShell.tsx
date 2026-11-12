import Link from "next/link";
import Footer from "@/components/Footer";
import { appName } from "@/lib/env";

/** The frame every private page shares: the public pages' measure and type, plus sign-out. */
export default function MeShell({
  title,
  subtitle,
  current,
  signedIn = true,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  current: "radar" | "settings" | "none";
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  const link = "underline decoration-rule underline-offset-4 hover:decoration-rule-strong";
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <nav className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs tracking-wide text-ink-faint">
          <Link href="/" className={link}>
            Sift
          </Link>
          {signedIn && (
            <>
              {current === "radar" ? <span>My radar</span> : <Link href="/me" className={link}>My radar</Link>}
              {current === "settings" ? <span>Settings</span> : <Link href="/me/settings" className={link}>Settings</Link>}
              <form action="/auth/sign-out" method="post" className="ml-auto">
                <button type="submit" className={link}>
                  Sign out
                </button>
              </form>
            </>
          )}
        </nav>

        <header className="mt-6 border-b border-rule-strong pb-4">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-ink-muted">{subtitle}</p>}
        </header>

        {children}
      </main>
      <Footer service={appName()} />
    </div>
  );
}
