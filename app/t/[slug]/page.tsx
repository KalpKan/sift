import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrainMaps from "@/components/brain/BrainMaps";
import Footer from "@/components/Footer";
import PaperEntry from "@/components/PaperEntry";
import { appName } from "@/lib/env";
import { isNew } from "@/lib/brain/network";
import { topicModel } from "@/lib/brain/public-model";
import { freshness, loadFeed, loadTopics } from "@/lib/page-data";

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
  const [{ data: feed, error }, { data: topics }] = await Promise.all([loadFeed(slug, LIMIT), loadTopics()]);
  // A slug that is not a topic is a 404, not an empty page: the difference
  // matters to anyone who mistyped a URL and to anything that crawls it.
  if (!feed && error?.startsWith("No topic")) notFound();
  const now = new Date();
  const map = feed ? topicModel({ slug, papers: feed.papers, topics, now }) : null;
  const link = "underline decoration-ink-faint underline-offset-4 hover:decoration-ink";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-8 sm:px-8 sm:pt-12">
        <p className="text-xs leading-[1.4] text-ink-faint">
          <Link href="/" className={link}>
            Sift
          </Link>
        </p>

        {/* The map sits right of the title on a wide screen, bottoms aligned, and below the count on a phone. */}
        <header className="mt-5 border-b border-rule-strong pb-2 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 pb-2">
            <h1 className="font-serif text-[28px] leading-[1.15] tracking-[-0.01em] sm:text-[34px] sm:leading-[1.1]">
              {feed?.name ?? slug}
            </h1>
            {feed && (
              <p className="mt-1.5 text-[13px] leading-[1.45] text-ink-muted">
                {feed.papers.length} papers, ranked {freshness(feed.updatedAt, now)}
              </p>
            )}
          </div>
          {map && (
            <div className="mt-3 sm:mt-0 sm:w-[240px] sm:flex-none">
              <BrainMaps variant="topic" clusters={map.clusters} neurons={map.neurons} />
            </div>
          )}
        </header>

        {feed ? (
          <>
            <div className="divide-y divide-rule">
              {feed.papers.map((paper, i) => (
                <PaperEntry
                  key={paper.id}
                  paper={paper}
                  rank={i + 1}
                  topic={feed.topic}
                  hue={map?.hue}
                  isNew={isNew(paper.published, now)}
                />
              ))}
            </div>

            {feed.papers.length === 0 && (
              <p className="py-8 text-[13px] leading-[1.45] text-ink-muted">
                Nothing yet. The first refresh runs on the first request and takes a few seconds.
              </p>
            )}

            {/*
              The query is shown, not hidden. It is the most important thing
              about a topic — it is what makes this feed different from a
              PubMed alert — and a reader who disagrees with the feed should be
              able to see exactly what was asked for.
            */}
            <section className="mt-11 border-t border-rule pt-6 sm:mt-14">
              <h2 className="text-xs leading-[1.4] text-ink-faint">The query</h2>
              <p className="mt-3 overflow-x-auto font-mono text-xs leading-[1.6] text-ink-muted">
                {feed.query}
              </p>
            </section>
          </>
        ) : (
          <p className="py-10 text-[13px] leading-[1.45] text-ink-muted">{error ?? "Could not load this feed."}</p>
        )}
      </main>
      <Footer service={appName()} />
    </div>
  );
}
