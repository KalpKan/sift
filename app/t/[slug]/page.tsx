import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import PaperEntry from "@/components/PaperEntry";
import { appName } from "@/lib/env";
import { freshness, loadFeed } from "@/lib/page-data";

// Reads the database and, when the cache is older than six hours, PubMed.
export const dynamic = "force-dynamic";

const LIMIT = 20;

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await loadFeed(slug, 1);
  const name = data?.name ?? slug;
  return { title: `${name} — Sift`, description: `The newest important papers in ${name.toLowerCase()}.` };
}

export default async function TopicPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const { data: feed, error } = await loadFeed(slug, LIMIT);
  // A slug that is not a topic is a 404, not an empty page: the difference
  // matters to anyone who mistyped a URL and to anything that crawls it.
  if (!feed && error?.startsWith("No topic")) notFound();
  const now = new Date();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs tracking-wide text-ink-faint">
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-rule-strong">
            Sift
          </Link>
        </p>

        <header className="mt-6 border-b border-rule-strong pb-4">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{feed?.name ?? slug}</h1>
          {feed && (
            <p className="mt-3 text-sm text-ink-muted">
              {feed.papers.length} papers, ranked {freshness(feed.updatedAt, now)}
            </p>
          )}
        </header>

        {feed ? (
          <>
            <div className="divide-y divide-rule">
              {feed.papers.map((paper, i) => (
                <PaperEntry key={paper.id} paper={paper} rank={i + 1} topic={feed.topic} />
              ))}
            </div>

            {feed.papers.length === 0 && (
              <p className="py-8 text-sm text-ink-muted">
                Nothing yet. The first refresh runs on the first request and takes a few seconds.
              </p>
            )}

            {/*
              The query is shown, not hidden. It is the most important thing
              about a topic — it is what makes this feed different from a
              PubMed alert — and a reader who disagrees with the feed should be
              able to see exactly what was asked for.
            */}
            <section className="mt-16 border-t border-rule pt-6">
              <h2 className="text-xs tracking-wide text-ink-faint">The query</h2>
              <p className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed text-ink-muted">
                {feed.query}
              </p>
            </section>
          </>
        ) : (
          <p className="py-10 text-sm text-ink-muted">{error ?? "Could not load this feed."}</p>
        )}
      </main>
      <Footer service={appName()} />
    </div>
  );
}
