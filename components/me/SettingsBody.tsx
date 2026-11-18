import FollowsForm from "@/components/me/FollowsForm";
import InterestList from "@/components/me/InterestList";

type Topic = { slug: string; name: string; followed: boolean };
type Interest = { term: string; weight: number; source: "obsidian" | "taps" | "manual" };

const h2 = "border-b border-rule-strong pb-3 font-serif text-[17px] leading-[1.3] sm:text-[18px]";

/**
 * The body of the settings page, shared by /me/settings and /dev/settings
 * (docs/design/brain.md section 8): two ruled sections, no map. The Interests
 * section is the same rows, fields and actions as before, restyled only.
 */
export default function SettingsBody({ topics, interests }: { topics: Topic[]; interests: Interest[] }) {
  return (
    <>
      <section className="mt-11 sm:mt-14">
        <h2 className={h2}>Topics on your radar</h2>
        <FollowsForm topics={topics} />
      </section>

      <section className="mt-11 sm:mt-14">
        <h2 className={h2}>Interests</h2>
        <p className="mt-3 text-[13px] leading-[1.45] text-ink-muted">
          Terms that lift a paper on your radar. They are visible only here, only to you.
        </p>
        <InterestList interests={interests} />
      </section>
    </>
  );
}
