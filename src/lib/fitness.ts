import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { addDays, startOfWeek, weekday, weekDays } from "@/lib/dates";
import { epley, sumMacros, type MacroTotals } from "@/lib/fitness-math";

// Server-side training and nutrition queries shared by the Fitness screens,
// the Today screen and the AI context.

export type RoutineSummary = {
  id: string;
  name: string;
  focus: string | null;
  color: string;
  estimatedMin: number;
  exerciseCount: number;
  setCount: number;
};

export type ScheduleDay = {
  weekday: number;
  templateId: string | null;
  label: string | null;
  notes: string | null;
  startMin: number | null;
  routine: RoutineSummary | null;
};

/** Active routines with exercise and set counts. */
export async function getRoutines(userId: string): Promise<RoutineSummary[]> {
  const rows = await db
    .select({
      id: t.workoutTemplates.id,
      name: t.workoutTemplates.name,
      focus: t.workoutTemplates.focus,
      color: t.workoutTemplates.color,
      estimatedMin: t.workoutTemplates.estimatedMin,
      exerciseCount: sql<number>`count(${t.templateExercises.id})`,
      setCount: sql<number>`coalesce(sum(${t.templateExercises.sets}), 0)`,
    })
    .from(t.workoutTemplates)
    .leftJoin(t.templateExercises, eq(t.templateExercises.templateId, t.workoutTemplates.id))
    .where(and(eq(t.workoutTemplates.userId, userId), eq(t.workoutTemplates.archived, false)))
    .groupBy(t.workoutTemplates.id)
    .orderBy(asc(t.workoutTemplates.createdAt));
  return rows.map((r) => ({ ...r, exerciseCount: Number(r.exerciseCount), setCount: Number(r.setCount) }));
}

/** The weekly split, always 7 entries (Mon..Sun). */
export async function getSchedule(userId: string, routines?: RoutineSummary[]): Promise<ScheduleDay[]> {
  const [rows, list] = await Promise.all([
    db.select().from(t.gymSchedule).where(eq(t.gymSchedule.userId, userId)),
    routines ? Promise.resolve(routines) : getRoutines(userId),
  ]);
  const byId = new Map(list.map((r) => [r.id, r]));
  return Array.from({ length: 7 }, (_, wd) => {
    const row = rows.find((r) => r.weekday === wd);
    const routine = row?.templateId ? (byId.get(row.templateId) ?? null) : null;
    return {
      weekday: wd,
      templateId: routine?.id ?? null,
      label: row?.label ?? null,
      notes: row?.notes ?? null,
      startMin: row?.startMin ?? null,
      routine,
    };
  });
}

export const scheduleName = (d: ScheduleDay) => d.routine?.name ?? d.label ?? "Rest";

type LogRow = typeof t.workoutLogs.$inferSelect;
const STATUS_RANK: Record<LogRow["status"], number> = { completed: 0, in_progress: 1, unlogged: 2, skipped: 3 };

/** The log that best represents a day when several exist. */
export function pickDayLog<T extends Pick<LogRow, "status">>(logs: T[]): T | null {
  if (!logs.length) return null;
  return [...logs].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])[0];
}

export type DayStatus = "completed" | "skipped" | "unlogged" | "in_progress" | "planned" | "rest" | "unreported";

export type TrainingDay = {
  date: string;
  weekday: number;
  isToday: boolean;
  isFuture: boolean;
  scheduled: ScheduleDay;
  log: Pick<LogRow, "id" | "name" | "status" | "skipReason" | "templateId" | "plannedTemplateId"> | null;
  /** Colour of what was done (or planned) */
  color: string;
  status: DayStatus;
  /** A different session than the split planned for this day */
  swapped: boolean;
  plannedName: string;
};

function dayStatus(scheduled: ScheduleDay, log: TrainingDay["log"], date: string, today: string): DayStatus {
  if (log) return log.status;
  if (!scheduled.routine) return "rest";
  return date >= today ? "planned" : "unreported";
}

/** Mon..Sun of the week containing `day`, with plan vs actual for each day. */
export async function getTrainingWeek(userId: string, day: string, today: string, schedule?: ScheduleDay[]) {
  const weekStart = startOfWeek(day);
  const weekEnd = addDays(weekStart, 6);
  const [sched, logs, routines] = await Promise.all([
    schedule ? Promise.resolve(schedule) : getSchedule(userId),
    db
      .select({
        id: t.workoutLogs.id,
        name: t.workoutLogs.name,
        date: t.workoutLogs.date,
        status: t.workoutLogs.status,
        skipReason: t.workoutLogs.skipReason,
        templateId: t.workoutLogs.templateId,
        plannedTemplateId: t.workoutLogs.plannedTemplateId,
      })
      .from(t.workoutLogs)
      .where(and(eq(t.workoutLogs.userId, userId), gte(t.workoutLogs.date, weekStart), lte(t.workoutLogs.date, weekEnd))),
    db
      .select({ id: t.workoutTemplates.id, color: t.workoutTemplates.color })
      .from(t.workoutTemplates)
      .where(eq(t.workoutTemplates.userId, userId)),
  ]);
  const colorOf = new Map(routines.map((r) => [r.id, r.color]));
  const days: TrainingDay[] = weekDays(weekStart).map((date) => {
    const scheduled = sched[weekday(date)];
    const dayLog = pickDayLog(logs.filter((l) => l.date === date));
    const log = dayLog ? { ...dayLog } : null;
    const status = dayStatus(scheduled, log, date, today);
    const plannedId = log?.plannedTemplateId ?? scheduled.templateId;
    const swapped = !!log && log.status !== "skipped" && !!log.templateId && log.templateId !== plannedId;
    return {
      date,
      weekday: weekday(date),
      isToday: date === today,
      isFuture: date > today,
      scheduled,
      log,
      color: (log?.templateId && colorOf.get(log.templateId)) || scheduled.routine?.color || "slate",
      status,
      swapped,
      plannedName: scheduleName(scheduled),
    };
  });

  const done = days.filter((d) => d.status === "completed" || d.status === "unlogged").length;
  const planned = sched.filter((d) => d.routine).length;
  const workingSets = await countWorkingSets(userId, weekStart, weekEnd);
  return { weekStart, days, done, planned, workingSets };
}

async function countWorkingSets(userId: string, from: string, to: string) {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.setLogs)
    .innerJoin(t.workoutLogs, eq(t.workoutLogs.id, t.setLogs.workoutLogId))
    .where(
      and(
        eq(t.workoutLogs.userId, userId),
        gte(t.workoutLogs.date, from),
        lte(t.workoutLogs.date, to),
        ne(t.workoutLogs.status, "skipped"),
        eq(t.setLogs.warmup, false),
        eq(t.setLogs.done, true),
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

/**
 * Consecutive weeks (ending this week if already met, else last week) with at
 * least `min(3, planned)` sessions done.
 */
export async function getWeekStreak(userId: string, today: string, planned: number) {
  const target = Math.max(1, Math.min(3, planned));
  const thisWeek = startOfWeek(today);
  const since = addDays(thisWeek, -7 * 52);
  const rows = await db
    .select({ date: t.workoutLogs.date })
    .from(t.workoutLogs)
    .where(
      and(
        eq(t.workoutLogs.userId, userId),
        gte(t.workoutLogs.date, since),
        inArray(t.workoutLogs.status, ["completed", "unlogged"]),
      ),
    );
  const perWeek = new Map<string, Set<string>>();
  for (const r of rows) {
    const w = startOfWeek(r.date);
    if (!perWeek.has(w)) perWeek.set(w, new Set());
    perWeek.get(w)!.add(r.date);
  }
  const met = (w: string) => (perWeek.get(w)?.size ?? 0) >= target;
  let streak = 0;
  let w = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (met(w)) {
    streak++;
    w = addDays(w, -7);
  }
  return { streak, target };
}

// ─────────────────────────── Ownership ───────────────────────────

export async function ownTemplate(userId: string, id: string) {
  const row = await db
    .select()
    .from(t.workoutTemplates)
    .where(and(eq(t.workoutTemplates.id, id), eq(t.workoutTemplates.userId, userId)))
    .get();
  if (!row) throw new Error("Routine not found");
  return row;
}

export async function ownWorkout(userId: string, id: string) {
  const row = await db
    .select()
    .from(t.workoutLogs)
    .where(and(eq(t.workoutLogs.id, id), eq(t.workoutLogs.userId, userId)))
    .get();
  if (!row) throw new Error("Workout not found");
  return row;
}

export async function ownExercise(userId: string, id: string) {
  const row = await db
    .select()
    .from(t.exercises)
    .where(and(eq(t.exercises.id, id), eq(t.exercises.userId, userId)))
    .get();
  if (!row) throw new Error("Exercise not found");
  return row;
}

export async function ownPlan(userId: string, id: string) {
  const row = await db
    .select()
    .from(t.dietPlans)
    .where(and(eq(t.dietPlans.id, id), eq(t.dietPlans.userId, userId)))
    .get();
  if (!row) throw new Error("Plan not found");
  return row;
}

// ─────────────────────────── History per exercise ───────────────────────────

export type PrevSet = { reps: number | null; weightKg: number | null; warmup: boolean; note: string | null };
export type ExerciseHistory = {
  /** Sets from the most recent other session that included the exercise */
  last: { date: string; sets: PrevSet[] } | null;
  /** All-time bests across working sets with known weight */
  maxWeight: number | null;
  maxE1rm: number | null;
  maxReps: number | null;
};

/** Last session + all-time bests for each exercise, ignoring `excludeLogId`. */
export async function getExerciseHistory(userId: string, exerciseIds: string[], excludeLogId?: string) {
  const out = new Map<string, ExerciseHistory>();
  if (!exerciseIds.length) return out;
  const rows = await db
    .select({
      exerciseId: t.setLogs.exerciseId,
      logId: t.setLogs.workoutLogId,
      date: t.workoutLogs.date,
      startedAt: t.workoutLogs.startedAt,
      setIndex: t.setLogs.setIndex,
      reps: t.setLogs.reps,
      weightKg: t.setLogs.weightKg,
      warmup: t.setLogs.warmup,
      note: t.setLogs.note,
    })
    .from(t.setLogs)
    .innerJoin(t.workoutLogs, eq(t.workoutLogs.id, t.setLogs.workoutLogId))
    .where(
      and(
        eq(t.workoutLogs.userId, userId),
        eq(t.workoutLogs.status, "completed"),
        eq(t.setLogs.done, true),
        inArray(t.setLogs.exerciseId, exerciseIds),
        excludeLogId ? ne(t.workoutLogs.id, excludeLogId) : undefined,
      ),
    )
    .orderBy(desc(t.workoutLogs.date), desc(t.workoutLogs.startedAt), asc(t.setLogs.setIndex));

  for (const id of exerciseIds) out.set(id, { last: null, maxWeight: null, maxE1rm: null, maxReps: null });
  const lastLog = new Map<string, string>();
  for (const r of rows) {
    const h = out.get(r.exerciseId)!;
    if (!lastLog.has(r.exerciseId)) lastLog.set(r.exerciseId, r.logId);
    if (lastLog.get(r.exerciseId) === r.logId) {
      h.last ??= { date: r.date, sets: [] };
      h.last.sets.push({ reps: r.reps, weightKg: r.weightKg, warmup: r.warmup, note: r.note });
    }
    if (r.warmup) continue;
    if (r.weightKg != null) {
      h.maxWeight = Math.max(h.maxWeight ?? 0, r.weightKg);
      const e = epley(r.weightKg, r.reps);
      if (e != null) h.maxE1rm = Math.max(h.maxE1rm ?? 0, e);
    }
    if (r.reps != null) h.maxReps = Math.max(h.maxReps ?? 0, r.reps);
  }
  return out;
}

// ─────────────────────────── Nutrition ───────────────────────────

export async function getActivePlan(userId: string) {
  return db
    .select()
    .from(t.dietPlans)
    .where(and(eq(t.dietPlans.userId, userId), eq(t.dietPlans.active, true)))
    .orderBy(desc(t.dietPlans.createdAt))
    .get();
}

export type NutritionDay = {
  totals: MacroTotals;
  target: (MacroTotals & { waterMl: number; planId: string; planName: string }) | null;
  waterMl: number;
  waterTargetMl: number;
  meals: (typeof t.mealLogs.$inferSelect)[];
};

export async function getNutritionDay(userId: string, day: string): Promise<NutritionDay> {
  const [plan, meals, daily] = await Promise.all([
    getActivePlan(userId),
    db
      .select()
      .from(t.mealLogs)
      .where(and(eq(t.mealLogs.userId, userId), eq(t.mealLogs.date, day)))
      .orderBy(asc(t.mealLogs.createdAt)),
    db
      .select({ waterMl: t.dailyLogs.waterMl })
      .from(t.dailyLogs)
      .where(and(eq(t.dailyLogs.userId, userId), eq(t.dailyLogs.date, day)))
      .get(),
  ]);
  return {
    totals: sumMacros(meals),
    target: plan
      ? {
          calories: plan.calories,
          proteinG: plan.proteinG,
          carbsG: plan.carbsG,
          fatG: plan.fatG,
          waterMl: plan.waterMl,
          planId: plan.id,
          planName: plan.name,
        }
      : null,
    waterMl: daily?.waterMl ?? 0,
    waterTargetMl: plan?.waterMl ?? 3000,
    meals,
  };
}

// ─────────────────────────── Today summary ───────────────────────────

export type TodayTraining = {
  date: string;
  /** What the weekly split says for today */
  scheduled: {
    name: string;
    isRest: boolean;
    templateId: string | null;
    focus: string | null;
    color: string;
    exerciseCount: number;
    setCount: number;
    estimatedMin: number | null;
    startMin: number | null;
    notes: string | null;
  };
  /** Today's workout log, if any (a swap shows a different name than scheduled) */
  log: { id: string; name: string; status: LogRow["status"]; skipReason: string | null; templateId: string | null } | null;
  nutrition: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    target: { calories: number; proteinG: number; carbsG: number; fatG: number; planName: string } | null;
  };
  water: { ml: number; targetMl: number };
};

/**
 * One-call summary of today's training and nutrition for the Today screen and
 * the AI context: scheduled session, its status, and food/water vs targets.
 */
export async function getTodayTraining(userId: string, today: string): Promise<TodayTraining> {
  const [schedule, logs, nutrition] = await Promise.all([
    getSchedule(userId),
    db
      .select({
        id: t.workoutLogs.id,
        name: t.workoutLogs.name,
        status: t.workoutLogs.status,
        skipReason: t.workoutLogs.skipReason,
        templateId: t.workoutLogs.templateId,
      })
      .from(t.workoutLogs)
      .where(and(eq(t.workoutLogs.userId, userId), eq(t.workoutLogs.date, today))),
    getNutritionDay(userId, today),
  ]);
  const s = schedule[weekday(today)];
  const { target, totals } = nutrition;
  return {
    date: today,
    scheduled: {
      name: scheduleName(s),
      isRest: !s.routine,
      templateId: s.templateId,
      focus: s.routine?.focus ?? null,
      color: s.routine?.color ?? "slate",
      exerciseCount: s.routine?.exerciseCount ?? 0,
      setCount: s.routine?.setCount ?? 0,
      estimatedMin: s.routine?.estimatedMin ?? null,
      startMin: s.startMin,
      notes: s.notes,
    },
    log: pickDayLog(logs),
    nutrition: {
      ...totals,
      target: target
        ? { calories: target.calories, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG, planName: target.planName }
        : null,
    },
    water: { ml: nutrition.waterMl, targetMl: nutrition.waterTargetMl },
  };
}

// ─────────────────────────── Body ───────────────────────────

export async function getWeights(userId: string, since: string) {
  const rows = await db
    .select({ date: t.bodyMetrics.date, weightKg: t.bodyMetrics.weightKg })
    .from(t.bodyMetrics)
    .where(and(eq(t.bodyMetrics.userId, userId), gte(t.bodyMetrics.date, since)))
    .orderBy(asc(t.bodyMetrics.date));
  return rows.filter((r): r is { date: string; weightKg: number } => r.weightKg != null);
}

export async function getLatestWeight(userId: string) {
  return db
    .select({ date: t.bodyMetrics.date, weightKg: t.bodyMetrics.weightKg })
    .from(t.bodyMetrics)
    .where(and(eq(t.bodyMetrics.userId, userId), sql`${t.bodyMetrics.weightKg} is not null`))
    .orderBy(desc(t.bodyMetrics.date))
    .get();
}
