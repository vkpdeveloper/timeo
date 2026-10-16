// Curated, muted palette used for goals, routines and calendar blocks.
// Each colour maps to CSS variables defined in globals.css (--c-<name> and
// --c-<name>-soft) so light and dark themes stay in sync.

export const PALETTE = ["coral", "amber", "sage", "teal", "sky", "indigo", "violet", "rose", "slate"] as const;
export type PaletteColor = (typeof PALETTE)[number];

export function isPaletteColor(c: unknown): c is PaletteColor {
  return typeof c === "string" && (PALETTE as readonly string[]).includes(c);
}

export const colorVar = (c: string) => `var(--c-${isPaletteColor(c) ? c : "slate"})`;
export const softVar = (c: string) => `var(--c-${isPaletteColor(c) ? c : "slate"}-soft)`;

/** Inline style that exposes --tint and --tint-soft for a palette colour. */
export function tint(c: string): React.CSSProperties {
  return { ["--tint" as string]: colorVar(c), ["--tint-soft" as string]: softVar(c), ["--tint-ink" as string]: "#fff" };
}
