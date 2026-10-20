// Pure training and nutrition helpers, safe for client and server.
import { diffDays } from "@/lib/dates";

export type WeightBasis = "total" | "per_hand" | "per_arm";

export type SetLike = {
  reps: number | null;
  weightKg: number | null;
  warmup: boolean;
  done?: boolean;
};

/** Epley estimated one-rep max. Null when weight or reps are unknown. */
export function epley(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps <= 0 || weightKg <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export const isWorking = (s: SetLike) => !s.warmup && (s.done ?? true);

/**
 * Volume (kg) of working sets with known weight. Weight is taken exactly as
 * logged: per-hand and per-arm loads are never doubled.
 */
export function volumeOf(sets: SetLike[]): number {
  let v = 0;
  for (const s of sets) {
    if (!isWorking(s) || s.weightKg == null || s.reps == null) continue;
    v += s.weightKg * s.reps;
  }
  return Math.round(v);
}

export const workingSetCount = (sets: SetLike[]) => sets.filter(isWorking).length;

/** Best working set by estimated 1RM (falls back to heaviest weight). */
export function bestSet<T extends SetLike>(sets: T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const s of sets) {
    if (!isWorking(s) || s.weightKg == null) continue;
    const score = epley(s.weightKg, s.reps) ?? s.weightKg;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export const fmtKg = (kg: number | null | undefined) =>
  kg == null ? "?" : Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 100) / 100);

/** "20 × 10" or "? × 8" */
export const fmtSet = (s: { weightKg: number | null; reps: number | null }) =>
  `${fmtKg(s.weightKg)} × ${s.reps ?? "?"}`;

export function basisLabel(basis: WeightBasis, unilateral = false): string | null {
  if (basis === "per_hand") return "kg per hand";
  if (basis === "per_arm") return unilateral ? "kg per arm · reps per arm" : "kg per arm";
  return unilateral ? "reps per side" : null;
}

export const fmtVolume = (kg: number) =>
  kg >= 10000 ? `${(kg / 1000).toFixed(1)}t` : `${kg.toLocaleString("en-US")} kg`;

export const fmtCompact = (n: number) => n.toLocaleString("en-US");

export type MacroTotals = { calories: number; proteinG: number; carbsG: number; fatG: number };

export function sumMacros(rows: MacroTotals[]): MacroTotals {
  return rows.reduce(
    (a, r) => ({
      calories: a.calories + r.calories,
      proteinG: a.proteinG + r.proteinG,
      carbsG: a.carbsG + r.carbsG,
      fatG: a.fatG + r.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Calendar-aware trailing average: for each point, the mean of points in the previous `days` days. */
export function rollingAverage(points: { date: string; value: number }[], days = 7): number[] {
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (diffDays(p.date, points[j].date) >= days) break;
      sum += points[j].value;
      n++;
    }
    return sum / n;
  });
}

/** A started workout runs until paused, finished, or this long has been trained. */
export const WORKOUT_LIMIT_MIN = 75;

export type WorkoutClock = { startedAt: number; pausedAt: number | null; pausedMs: number };

/** Time trained so far: pauses excluded, capped at the workout limit. */
export function trainedMs(c: WorkoutClock, now: number) {
  return Math.min(WORKOUT_LIMIT_MIN * 60_000, Math.max(0, (c.pausedAt ?? now) - c.startedAt - c.pausedMs));
}

export const WORKOUT_STATUS_LABEL = {
  in_progress: "In progress",
  completed: "Done",
  skipped: "Skipped",
  unlogged: "Done, not logged",
} as const;

export const MUSCLES = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "core", label: "Core" },
  { value: "full_body", label: "Full body" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Mobility" },
] as const;
export type Muscle = (typeof MUSCLES)[number]["value"];
export const muscleLabel = (m: string) => MUSCLES.find((x) => x.value === m)?.label ?? m;

export type ExerciseOption = {
  id: string;
  name: string;
  muscle: string;
  equipment: string | null;
  type: "weight" | "bodyweight" | "cardio";
  weightBasis: WeightBasis;
  unilateral: boolean;
  catalogId: string | null;
};

/** "2:00", "90s" style rest label */
export const fmtRest = (sec: number) => (sec % 60 === 0 ? `${sec / 60}:00` : sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
