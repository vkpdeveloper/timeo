// Goal, routine and calendar colours. Each maps to CSS variables in
// globals.css (--c-<name> and --c-<name>-soft), light-dark() pairs.
// Calm greens, blues and earth tones only.

export const PALETTE = ["pine", "sage", "teal", "sky", "sand", "olive", "stone"] as const;
export type PaletteColor = (typeof PALETTE)[number];

/** Default for new goals and routines. */
export const DEFAULT_COLOR: PaletteColor = "pine";

/** Keys stored by earlier versions, mapped to the colour they show as now. */
const LEGACY: Record<string, PaletteColor> = {
  coral: "sand",
  amber: "sand",
  rose: "stone",
  violet: "olive",
  indigo: "sky",
  slate: "stone",
};

/** True only for the current keys (use for validating new input). */
export function isPaletteColor(c: unknown): c is PaletteColor {
  return typeof c === "string" && (PALETTE as readonly string[]).includes(c);
}

/** Any stored key (current or legacy) -> a current palette key. Unknown -> stone. */
export function resolveColor(c: string | null | undefined): PaletteColor {
  if (isPaletteColor(c)) return c;
  return (c && LEGACY[c]) || "stone";
}

export const colorVar = (c: string) => `var(--c-${resolveColor(c)})`;
/** Solid soft fill of a colour (a flat mix with the surface, never a gradient). */
export const softVar = (c: string) => `var(--c-${resolveColor(c)}-soft)`;

/** Inline style that exposes --tint, --tint-soft and --tint-ink for a palette colour. */
export function tint(c: string): React.CSSProperties {
  return {
    ["--tint" as string]: colorVar(c),
    ["--tint-soft" as string]: softVar(c),
    ["--tint-ink" as string]: "var(--accent-ink)",
  };
}
