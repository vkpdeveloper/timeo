// Labels shared by the goals screens (safe on server and client).

export const TIERS = [
  { value: "core", label: "Core", heading: "Core focus", hint: "Most of your energy" },
  { value: "secondary", label: "Secondary", heading: "Secondary focus", hint: "Steady progress" },
  { value: "support", label: "Support", heading: "Support", hint: "Keeps the rest working" },
] as const;

export type Tier = (typeof TIERS)[number]["value"];

export const AREAS = [
  { value: "work", label: "Work" },
  { value: "health", label: "Health" },
  { value: "creative", label: "Creative" },
  { value: "learning", label: "Learning" },
  { value: "personal", label: "Personal" },
  { value: "money", label: "Money" },
] as const;

export type Area = (typeof AREAS)[number]["value"];

export const tierLabel = (t: string) => TIERS.find((x) => x.value === t)?.label ?? t;
export const areaLabel = (a: string) => AREAS.find((x) => x.value === a)?.label ?? a;

/** "2.5" -> "2.5h", "3" -> "3h" */
export const fmtHours = (h: number) => `${Math.round(h * 10) / 10}h`;

/** Minutes as "1h 30m"; zero reads "0h". */
export const fmtMin = (min: number) => {
  const m = Math.max(0, Math.round(min));
  if (m === 0) return "0h";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
};
