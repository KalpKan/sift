import Link from "next/link";
import { BrainHoverProvider } from "@/components/brain/BrainHover";
import BrainFigure from "@/components/brain/BrainFigure";
import BrainMaps from "@/components/brain/BrainMaps";
import RadarCaption from "@/components/me/RadarCaption";
import RadarEntry from "@/components/me/RadarEntry";
import { radarModel, type RadarField } from "@/lib/brain/radar-model";
import type { MePaper } from "@/lib/me-api";
import { freshness } from "@/lib/page-data";

/** "4 fields · ranked 3 hours ago · ranker p1": the field names live in the map now. */
export function radarSubtitle(fieldCount: number, updatedAt: string, now: Date, rankerVersion: string): string {
  const fields = fieldCount === 0 ? "No fields followed" : `${fieldCount} field${fieldCount === 1 ? "" : "s"}`;
  return `${fields} · ranked ${freshness(updatedAt, now)} · ranker ${rankerVersion}`;
}

/**
 * The body of the private radar, shared by /me and /dev/radar: the map as a
 * figure, the ruled list, and the footnote. The map and the rows sit under one
 * hover provider, so hovering a row lights its cell and the reverse.
 */
export default function RadarView({ fields, papers, now }: { fields: RadarField[]; papers: MePaper[]; now: Date }) {
  const model = radarModel({ fields, papers, now });
  return (
    <BrainHoverProvider>
      <BrainFigure
        topRule={false}
        caption={
          <RadarCaption
            fieldCount={fields.length}
            papers={model.rows.map((r) => ({ pmid: r.paper.pmid, verdict: r.paper.verdict }))}
            newCount={model.newCount}
          />
        }
      >
        <BrainMaps variant="radar" clusters={model.clusters} neurons={model.neurons} />
      </BrainFigure>

      {model.rows.length > 0 ? (
        <div className="divide-y divide-rule">
          {model.rows.map((r) => (
            <RadarEntry key={r.paper.id} paper={r.paper} hue={r.hue} isNew={r.isNew} topicName={r.topicName} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-[13px] leading-[1.45] text-ink-muted">
          Nothing to show yet. Follow a topic in{" "}
          <Link href="/me/settings" className="underline decoration-ink-faint underline-offset-4 hover:decoration-ink">
            settings
          </Link>
          , or wait for the morning refresh.
        </p>
      )}

      <p className="mt-2 border-t border-rule pt-4 text-xs leading-[1.4] text-ink-faint">
        👍 and 👎 teach the ranking which of your interests matter and grade it against a plain newest-first list,
        on exactly the papers you rated.
      </p>
    </BrainHoverProvider>
  );
}
