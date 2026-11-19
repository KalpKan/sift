import type { CSSProperties } from "react";
import Link from "next/link";
import BrainFigure from "@/components/brain/BrainFigure";
import BrainMaps from "@/components/brain/BrainMaps";
import Footer from "@/components/Footer";
import PaperEntry from "@/components/PaperEntry";
import { appName } from "@/lib/env";
import { heroModel, topicIndex } from "@/lib/brain/public-model";
import { isNew } from "@/lib/brain/network";
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
  const hero = topics && topics.length > 0 ? heroModel(topics) : null;
  const showcaseHue = topicIndex(SHOWCASE, topics) % 4;
  const link = "underline decoration-ink-faint underline-offset-4 hover:decoration-ink";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-8 sm:px-8 sm:pt-12">
        {/* With the map, the figure's top rule is the header's rule. */}
        <header className={hero ? "pb-4" : "border-b border-rule-strong pb-4"}>
          <h1 className="font-serif text-[36px] leading-[1.1] tracking-[-0.01em] sm:text-[44px] sm:leading-[1.05]">Sift</h1>
        </header>

        {hero && (
          <BrainFigure caption={hero.caption}>
            <BrainMaps variant="hero" clusters={hero.clusters} neurons={hero.neurons} />
          </BrainFigure>
        )}

        <section className="mt-8 space-y-5 font-serif text-[18px] leading-[1.55] sm:text-[19px] sm:leading-[1.6]">
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

        <section className="mt-11 sm:mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule-strong pb-3">
            <h2 className="font-serif text-[17px] leading-[1.3] sm:text-[18px]">
              {feed ? feed.name : "Neuromodulation"}
            </h2>
            <p className="text-xs leading-[1.4] text-ink-faint">
              {feed ? `ranked ${freshness(feed.updatedAt, now)}` : "unavailable"}
            </p>
          </div>

          {feed && feed.papers.length > 0 ? (
            <div className="divide-y divide-rule">
              {feed.papers.map((paper, i) => (
                <PaperEntry
                  key={paper.id}
                  paper={paper}
                  rank={i + 1}
                  topic={feed.topic}
                  hue={showcaseHue}
                  isNew={isNew(paper.published, now)}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-[13px] leading-[1.45] text-ink-muted">
              {feedError ?? "No papers yet. The first refresh runs on the first request."}
            </p>
          )}

          <p className="mt-2 border-t border-rule pt-4 text-[13px] leading-[1.45]">
            <Link href={`/t/${SHOWCASE}`} className={link}>
              The full {feed ? feed.name.toLowerCase() : SHOWCASE} feed
            </Link>
          </p>
        </section>

        {topics && topics.length > 0 && (
          <section className="mt-11 sm:mt-14">
            <h2 className="border-b border-rule-strong pb-3 font-serif text-[17px] leading-[1.3] sm:text-[18px]">Topics</h2>
            <ul className="divide-y divide-rule">
              {topics.map((t, i) => (
                <li
                  key={t.slug}
                  style={{ "--c": `var(--cluster-${(i % 4) + 1})` } as CSSProperties}
                  className="grid grid-cols-[18px_minmax(0,1fr)] py-4"
                >
                  <span aria-hidden className="mt-[10px] inline-block size-2 rounded-full bg-[var(--c)]" />
                  <div>
                    <Link href={`/t/${t.slug}`} className={`font-serif text-[17px] leading-[1.35] ${link}`}>
                      {t.name}
                    </Link>
                    {t.description && <p className="mt-1 text-[13px] leading-[1.45] text-ink-muted">{t.description}</p>}
                  </div>
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
