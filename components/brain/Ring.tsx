/** The 7 px ring in a figure caption: --spike for "new", --reinforce for "marked useful" (docs/design/brain.md section 8). */
export default function Ring({ tone }: { tone: "spike" | "reinforce" }) {
  return (
    <span
      aria-hidden
      className={`mr-1.5 inline-block size-[7px] rounded-full border-[1.25px] align-[-0.5px] ${
        tone === "spike" ? "border-spike" : "border-reinforce"
      }`}
    />
  );
}
