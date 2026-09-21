import Link from "next/link";
import Footer from "@/components/Footer";
import PaperEntry from "@/components/PaperEntry";
import { appName } from "@/lib/env";
import { freshness, loadFeed, loadTopics } from "@/lib/page-data";

// Reads the database and, on a cold cache, PubMed. Never prerendered.
export const dynamic = "force-dynamic";

/** The topic the front page proves itself with. */
const SHOWCASE = "neuromodulation";
const SHOWCASE_COUNT = 5;

export default async function Home() {
  const [{ data: feed, error: feedError }, { data: topics }] = await Promise.all([
    loadFeed(SHOWCASE, SHOWCASE_COUNT),
    loadTopics(),
  ]);
  const now = new Date();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <header className="border-b border-rule-strong pb-4">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Sift</h1>
        </header>

        <section className="mt-8 space-y-5 font-serif text-lg leading-relaxed sm:text-xl">
          <p>
            PubMed publishes about <span className="tabular">280</span> papers a week on neuromodulation
            alone. Almost nobody reads <span className="italic">280</span> papers a week. Sift reads the
            list for you and puts the three that matter on your phone&rsquo;s Lock Screen.
          </p>
          <p className="text-ink-muted">
            It is not a search engine and not an alert. Every topic is a hand-written PubMed query, and
            every paper is scored on what can be known for free: whether it is a meta-analysis or a case
            report, how new it is, where it was published, and what its title gives away. The feed below
            is live. So are the reasons under each paper &mdash; if the ranking is wrong, it tells you why
            it was wrong.
          </p>
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule-strong pb-3">
            <h2 className="font-serif text-2xl">
              {feed ? feed.name : "Neuromodulation"}
            </h2>
            <p className="text-xs text-ink-faint">
              {feed ? `ranked ${freshness(feed.updatedAt, now)}` : "unavailable"}
            </p>
          </div>

          {feed && feed.papers.length > 0 ? (
            <div className="divide-y divide-rule">
              {feed.papers.map((paper, i) => (
                <PaperEntry key={paper.id} paper={paper} rank={i + 1} topic={feed.topic} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-ink-muted">
              {feedError ?? "No papers yet. The first refresh runs on the first request."}
            </p>
          )}

          <p className="mt-2 border-t border-rule pt-4 text-sm">
            <Link href={`/t/${SHOWCASE}`} className="underline decoration-rule underline-offset-4 hover:decoration-rule-strong">
              The full {feed ? feed.name.toLowerCase() : SHOWCASE} feed
            </Link>
          </p>
        </section>

        {topics && topics.length > 0 && (
          <section className="mt-16">
            <h2 className="border-b border-rule-strong pb-3 font-serif text-2xl">Topics</h2>
            <ul className="divide-y divide-rule">
              {topics.map((t) => (
                <li key={t.slug} className="py-5">
                  <Link
                    href={`/t/${t.slug}`}
                    className="font-serif text-lg underline decoration-rule underline-offset-4 hover:decoration-rule-strong"
                  >
                    {t.name}
                  </Link>
                  {t.description && <p className="mt-1 text-sm text-ink-muted">{t.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer service={appName()} />
    </div>
  );
}
