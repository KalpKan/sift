import Footer from "@/components/Footer";
import { appName } from "@/lib/env";

/**
 * Placeholder home page. Replace everything inside <main> with the app; keep
 * the <Footer /> (or move it to app/layout.tsx once every page should show it).
 */
export default function Home() {
  const name = appName();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          A new project started from{" "}
          <a
            href="https://github.com/KalpKan/portfolio-template"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            KalpKan/portfolio-template
          </a>
          . Edit <code className="font-mono">app/page.tsx</code> to replace this page.
        </p>
      </main>
      <Footer service={name} />
    </div>
  );
}
