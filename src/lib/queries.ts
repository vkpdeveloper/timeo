import "server-only";
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import { db, t } from "@/db";
import { addDays, diffDays, SEASON_DAYS } from "@/lib/dates";

/** The user's active season, if any. */
export async function getActiveSeason(userId: string) {
  return db
    .select()
    .from(t.seasons)
    .where(and(eq(t.seasons.userId, userId), eq(t.seasons.status, "active")))
    .orderBy(desc(t.seasons.createdAt))
    .get();
}

export type SeasonProgress = { day: number; total: number; daysLeft: number; week: number; pct: number };

export function seasonProgress(season: { startDate: string; endDate: string }, today: string): SeasonProgress {
  const total = Math.max(1, diffDays(season.endDate, season.startDate) + 1);
  const day = Math.max(1, Math.min(total, diffDays(today, season.startDate) + 1));
  return {
    day,
    total,
    daysLeft: Math.max(0, total - day),
    week: Math.min(Math.ceil(total / 7), Math.ceil(day / 7)),
    pct: day / total,
  };
}

export const seasonEndFor = (startDate: string) => addDays(startDate, SEASON_DAYS - 1);

/** Open goals of the active season, ordered by tier then manual order. */
export async function getSeasonGoals(userId: string, seasonId: string) {
  const rows = await db
    .select()
    .from(t.goals)
    .where(and(eq(t.goals.userId, userId), eq(t.goals.seasonId, seasonId)))
    .orderBy(asc(t.goals.sortOrder), asc(t.goals.createdAt));
  const rank = { core: 0, secondary: 1, support: 2 } as const;
  return rows.sort((a, b) => rank[a.tier] - rank[b.tier] || a.sortOrder - b.sortOrder);
}

/** Lightweight goal list for pickers. */
export async function getGoalOptions(userId: string) {
  const season = await getActiveSeason(userId);
  if (!season) return [];
  return db
    .select({ id: t.goals.id, title: t.goals.title, color: t.goals.color, tier: t.goals.tier })
    .from(t.goals)
    .where(and(eq(t.goals.seasonId, season.id), isNull(t.goals.completedAt)))
    .orderBy(asc(t.goals.sortOrder), asc(t.goals.createdAt));
}

/** Throws unless the goal belongs to the user. Returns null for empty ids. */
export async function ownGoalId(userId: string, goalId: string | null): Promise<string | null> {
  if (!goalId) return null;
  const g = await db
    .select({ id: t.goals.id })
    .from(t.goals)
    .where(and(eq(t.goals.id, goalId), eq(t.goals.userId, userId)))
    .get();
  if (!g) throw new Error("Goal not found");
  return g.id;
}

export async function ownTaskId(userId: string, taskId: string | null): Promise<string | null> {
  if (!taskId) return null;
  const row = await db
    .select({ id: t.tasks.id })
    .from(t.tasks)
    .where(and(eq(t.tasks.id, taskId), eq(t.tasks.userId, userId)))
    .get();
  if (!row) throw new Error("Task not found");
  return row.id;
}

/** A day's time blocks, in order. */
export async function getDayBlocks(userId: string, date: string) {
  return db
    .select()
    .from(t.blocks)
    .where(and(eq(t.blocks.userId, userId), eq(t.blocks.date, date)))
    .orderBy(asc(t.blocks.startMin));
}

/** Tasks due today plus anything overdue and still open. Open ones first. */
export async function getTodayTasks(userId: string, today: string) {
  return db
    .select()
    .from(t.tasks)
    .where(
      and(
        eq(t.tasks.userId, userId),
        or(eq(t.tasks.dueDate, today), and(lt(t.tasks.dueDate, today), isNull(t.tasks.doneAt))),
      ),
    )
    .orderBy(asc(t.tasks.doneAt), asc(t.tasks.dueMin), asc(t.tasks.createdAt));
}
