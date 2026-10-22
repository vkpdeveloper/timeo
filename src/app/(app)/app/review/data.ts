import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { db, t } from "@/db";
import type { BLOCK_KINDS, GOAL_STATUSES } from "@/db/schema";
import { addDays, weekDays } from "@/lib/dates";

export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type WeekStats = {
  days: { date: string; focusMin: number }[];
  focusMin: number;
  sessions: number;
  avgQuality: number | null;
  blocks: {
    planned: number;
    done: number;
    skipped: number;
    /** minutes of blocks dated up to `asOf`, skipped ones included */
    dueMin: number;
    /** minutes of blocks marked done */
    doneMin: number;
  };
  workouts: { done: number; scheduled: number };
};

/** Focus, blocks and workouts for the week starting on `weekStart` (a Monday). `asOf` caps "due" time (defaults to the week's end). */
export async function getWeekStats(userId: string, weekStart: string, asOf?: string): Promise<WeekStats> {
  const end = addDays(weekStart, 6);
  const [sessions, blocks, workouts, schedule] = await Promise.all([
    db
      .select({ date: t.focusSessions.date, focusedMin: t.focusSessions.focusedMin, quality: t.focusSessions.quality })
      .from(t.focusSessions)
      .where(and(eq(t.focusSessions.userId, userId), gte(t.focusSessions.date, weekStart), lte(t.focusSessions.date, end))),
    db
      .select({
        kind: t.blocks.kind,
        date: t.blocks.date,
        startMin: t.blocks.startMin,
        endMin: t.blocks.endMin,
        doneAt: t.blocks.doneAt,
        skippedAt: t.blocks.skippedAt,
      })
      .from(t.blocks)
      // calendar events aren't plans you kept or missed
      .where(and(eq(t.blocks.userId, userId), gte(t.blocks.date, weekStart), lte(t.blocks.date, end), isNull(t.blocks.integrationId))),
    db
      .select({ status: t.workoutLogs.status })
      .from(t.workoutLogs)
      .where(
        and(
          eq(t.workoutLogs.userId, userId),
          gte(t.workoutLogs.date, weekStart),
          lte(t.workoutLogs.date, end),
          inArray(t.workoutLogs.status, ["completed", "unlogged"]),
        ),
      ),
    db
      .select({ id: t.gymSchedule.id })
      .from(t.gymSchedule)
      .where(and(eq(t.gymSchedule.userId, userId), isNotNull(t.gymSchedule.templateId))),
  ]);

  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.focusedMin);
  const qualities = sessions.map((s) => s.quality).filter((q): q is number => q != null);
  // meals are routine, not plan: leave them out of the block count
  const planned = blocks.filter((b) => b.kind !== "meal");
  const len = (b: (typeof planned)[number]) => Math.max(0, b.endMin - b.startMin);
  const cutoff = asOf && asOf < end ? asOf : end;

  return {
    days: weekDays(weekStart).map((date) => ({ date, focusMin: perDay.get(date) ?? 0 })),
    focusMin: sessions.reduce((n, s) => n + s.focusedMin, 0),
    sessions: sessions.length,
    avgQuality: qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : null,
    blocks: {
      planned: planned.length,
      done: planned.filter((b) => b.doneAt != null).length,
      skipped: planned.filter((b) => b.skippedAt != null && b.doneAt == null).length,
      dueMin: planned.filter((b) => b.date <= cutoff).reduce((n, b) => n + len(b), 0),
      doneMin: planned.filter((b) => b.doneAt != null).reduce((n, b) => n + len(b), 0),
    },
    workouts: { done: workouts.length, scheduled: schedule.length },
  };
}

export type EnergyRow = { key: string; label: string; color?: string; avg: number; sessions: number; minutes: number };

/** Average post-session energy (-2..+2) grouped by goal and by block kind. */
export async function getEnergyReport(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      energy: t.focusSessions.energy,
      focusedMin: t.focusSessions.focusedMin,
      label: t.focusSessions.label,
      goalId: t.focusSessions.goalId,
      goalTitle: t.goals.title,
      goalColor: t.goals.color,
      kind: t.blocks.kind,
    })
    .from(t.focusSessions)
    .leftJoin(t.goals, eq(t.goals.id, t.focusSessions.goalId))
    .leftJoin(t.blocks, eq(t.blocks.id, t.focusSessions.blockId))
    .where(
      and(
        eq(t.focusSessions.userId, userId),
        gte(t.focusSessions.date, from),
        lte(t.focusSessions.date, to),
        isNotNull(t.focusSessions.energy),
      ),
    );

  const group = (keyOf: (r: (typeof rows)[number]) => { key: string; label: string; color?: string } | null) => {
    const map = new Map<string, EnergyRow & { sum: number }>();
    for (const r of rows) {
      const k = keyOf(r);
      if (!k) continue;
      const cur = map.get(k.key) ?? { ...k, avg: 0, sessions: 0, minutes: 0, sum: 0 };
      cur.sum += r.energy ?? 0;
      cur.sessions += 1;
      cur.minutes += r.focusedMin;
      map.set(k.key, cur);
    }
    return [...map.values()]
      .map(({ sum, ...g }) => ({ ...g, avg: sum / g.sessions }))
      .sort((a, b) => b.avg - a.avg || b.minutes - a.minutes);
  };

  return {
    sessions: rows.length,
    byGoal: group((r) =>
      r.goalId && r.goalTitle
        ? { key: r.goalId, label: r.goalTitle, color: r.goalColor ?? undefined }
        : { key: "none", label: "No goal" },
    ),
    byKind: group((r) => (r.kind ? { key: r.kind, label: KIND_LABEL[r.kind] } : null)),
    // individual sessions, best and worst, to jog memory in the weekly review
    top: rows
      .filter((r) => (r.energy ?? 0) > 0)
      .sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0))
      .map((r) => r.label),
    bottom: rows
      .filter((r) => (r.energy ?? 0) < 0)
      .sort((a, b) => (a.energy ?? 0) - (b.energy ?? 0))
      .map((r) => r.label),
  };
}

export const KIND_LABEL: Record<BlockKind, string> = {
  focus: "Deep work",
  meeting: "Meetings",
  workout: "Workouts",
  meal: "Meals",
  life: "Life",
  admin: "Admin",
};

/** Consecutive days with a daily reflection, ending today (or yesterday if today is still open). */
export async function getReflectionStreak(userId: string, today: string) {
  const from = addDays(today, -120);
  const rows = await db
    .select({ date: t.reflections.date })
    .from(t.reflections)
    .where(and(eq(t.reflections.userId, userId), eq(t.reflections.kind, "daily"), gte(t.reflections.date, from)));
  const days = new Set(rows.map((r) => r.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ date: d, done: days.has(d) }));
  return { streak, last14, total: days.size };
}

export type GoalWeek = {
  id: string;
  title: string;
  color: string;
  tier: string;
  outcome: string | null;
  plannedMin: number;
  doneMin: number;
  focusMin: number;
  stepsDone: number;
  stepsTotal: number;
  reschedules: number;
  skipped: number;
  update: { status: GoalStatus; confidence: number | null; note: string | null } | null;
  previous: { status: GoalStatus; confidence: number | null; weekStart: string } | null;
  currentStatus: GoalStatus;
};

/** Per-goal numbers for the weekly review. */
export async function getGoalWeeks(userId: string, seasonId: string, weekStart: string): Promise<GoalWeek[]> {
  const end = addDays(weekStart, 6);
  const goals = await db
    .select()
    .from(t.goals)
    .where(and(eq(t.goals.userId, userId), eq(t.goals.seasonId, seasonId), isNull(t.goals.completedAt)));
  if (!goals.length) return [];
  const ids = goals.map((g) => g.id);
  const [blocks, sessions, steps, updates] = await Promise.all([
    db
      .select({
        goalId: t.blocks.goalId,
        startMin: t.blocks.startMin,
        endMin: t.blocks.endMin,
        doneAt: t.blocks.doneAt,
        skippedAt: t.blocks.skippedAt,
        rescheduleCount: t.blocks.rescheduleCount,
      })
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, userId), inArray(t.blocks.goalId, ids), gte(t.blocks.date, weekStart), lte(t.blocks.date, end))),
    db
      .select({ goalId: t.focusSessions.goalId, focusedMin: t.focusSessions.focusedMin })
      .from(t.focusSessions)
      .where(
        and(
          eq(t.focusSessions.userId, userId),
          inArray(t.focusSessions.goalId, ids),
          gte(t.focusSessions.date, weekStart),
          lte(t.focusSessions.date, end),
        ),
      ),
    db
      .select({ goalId: t.tasks.goalId, doneAt: t.tasks.doneAt })
      .from(t.tasks)
      .where(and(eq(t.tasks.userId, userId), inArray(t.tasks.goalId, ids), eq(t.tasks.weekStart, weekStart))),
    db
      .select()
      .from(t.goalUpdates)
      .where(and(eq(t.goalUpdates.userId, userId), inArray(t.goalUpdates.goalId, ids), lte(t.goalUpdates.weekStart, weekStart)))
      .orderBy(desc(t.goalUpdates.weekStart), desc(t.goalUpdates.createdAt)),
  ]);

  const rank = { core: 0, secondary: 1, support: 2 } as const;
  return goals
    .sort((a, b) => rank[a.tier] - rank[b.tier] || a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    .map((g) => {
      const gb = blocks.filter((b) => b.goalId === g.id);
      const len = (b: (typeof gb)[number]) => Math.max(0, b.endMin - b.startMin);
      const gs = steps.filter((s) => s.goalId === g.id);
      const gu = updates.filter((u) => u.goalId === g.id);
      const current = gu.find((u) => u.weekStart === weekStart);
      const prev = gu.find((u) => u.weekStart < weekStart);
      return {
        id: g.id,
        title: g.title,
        color: g.color,
        tier: g.tier,
        outcome: g.outcome,
        plannedMin: gb.reduce((n, b) => n + len(b), 0),
        doneMin: gb.filter((b) => b.doneAt != null).reduce((n, b) => n + len(b), 0),
        focusMin: sessions.filter((s) => s.goalId === g.id).reduce((n, s) => n + s.focusedMin, 0),
        stepsDone: gs.filter((s) => s.doneAt != null).length,
        stepsTotal: gs.length,
        reschedules: gb.reduce((n, b) => n + b.rescheduleCount, 0),
        skipped: gb.filter((b) => b.skippedAt != null && b.doneAt == null).length,
        update: current ? { status: current.status, confidence: current.confidence, note: current.note } : null,
        previous: prev ? { status: prev.status, confidence: prev.confidence, weekStart: prev.weekStart } : null,
        currentStatus: g.status,
      };
    });
}

/** Past weekly reviews with each goal's status that week. */
export async function getPastReviews(userId: string, limit = 8) {
  const reviews = await db
    .select()
    .from(t.reflections)
    .where(and(eq(t.reflections.userId, userId), eq(t.reflections.kind, "weekly")))
    .orderBy(desc(t.reflections.date))
    .limit(limit);
  if (!reviews.length) return [];
  const updates = await db
    .select({
      weekStart: t.goalUpdates.weekStart,
      status: t.goalUpdates.status,
      color: t.goals.color,
      title: t.goals.title,
    })
    .from(t.goalUpdates)
    .innerJoin(t.goals, eq(t.goals.id, t.goalUpdates.goalId))
    .where(
      and(
        eq(t.goalUpdates.userId, userId),
        inArray(
          t.goalUpdates.weekStart,
          reviews.map((r) => r.date),
        ),
      ),
    );
  return reviews.map((r) => ({ ...r, updates: updates.filter((u) => u.weekStart === r.date) }));
}
