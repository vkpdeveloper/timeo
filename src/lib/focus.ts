// Focus session helpers shared by the focus screen, its server actions and
// anything that reports on focus (Today, Review, the coach).

export const FOCUS_PRESETS = [25, 50, 90] as const;
export const FOCUS_MIN = 5;
export const FOCUS_MAX = 240;

/** Energy after a session, stored as -2 … +2. */
export const ENERGY_OPTIONS = [
  { value: -2, label: "Drained" },
  { value: -1, label: "Low" },
  { value: 0, label: "Neutral" },
  { value: 1, label: "Good" },
  { value: 2, label: "Energised" },
] as const;

/** Self rating 1-5 asked after a session. */
export const RATING_LABELS = ["Scattered", "Distracted", "Okay", "Focused", "Deep"] as const;

/**
 * Focus quality, 0-100.
 *
 *   50% completion  focused / planned minutes, capped at 1
 *   35% rating      self rating 1-5 mapped to 0..1 (missing counts as 3)
 *   15% pauses      full marks with no pauses, minus a quarter per pause (0 at 4+)
 *
 * Example: 45 of 50 min, rated 4, one pause → 0.5·0.9 + 0.35·0.75 + 0.15·0.75 = 0.825 → 83.
 */
export function focusQuality({
  focusedMin,
  plannedMin,
  rating,
  pauses,
}: {
  focusedMin: number;
  plannedMin: number;
  rating: number | null | undefined;
  pauses: number;
}): number {
  const completion = plannedMin > 0 ? Math.min(1, Math.max(0, focusedMin / plannedMin)) : 0;
  const r = Math.min(5, Math.max(1, rating ?? 3));
  const ratingScore = (r - 1) / 4;
  const pauseScore = Math.max(0, 1 - Math.max(0, pauses) * 0.25);
  return Math.round(100 * (0.5 * completion + 0.35 * ratingScore + 0.15 * pauseScore));
}

/** Short word for a quality score. */
export function qualityLabel(q: number): string {
  if (q >= 85) return "Deep focus";
  if (q >= 70) return "Solid focus";
  if (q >= 50) return "Some focus";
  return "Scattered";
}

/** 1499 seconds → "24:59"; hours shown when needed ("1:04:59"). */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
