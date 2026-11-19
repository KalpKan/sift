/**
 * The 8 px dot beside a rank (docs/design/brain.md section 7): always a plain
 * circle in the field's hue (`--c` on an ancestor). New rings it in --spike, a
 * 👎 hollows it. Shared by the private and the public rows.
 */
export function dotClass(verdict: 1 | -1 | null, isNew: boolean): string {
  if (verdict === -1) return "bg-transparent shadow-[inset_0_0_0_1px_var(--c)]";
  if (isNew) return "bg-[var(--c)] shadow-[0_0_0_2px_var(--paper),0_0_0_3.25px_var(--spike)]";
  return "bg-[var(--c)]";
}
