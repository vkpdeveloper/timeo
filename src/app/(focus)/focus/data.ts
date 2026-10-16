import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db, t } from "@/db";

export type FocusSessionSummary = {
  id: string;
  label: string;
  startedAt: number;
  focusedMin: number;
  quality: number | null;
  color: string | null;
};

/** Finished sessions for a day, oldest first, with the goal colour. */
export async function listDaySessions(userId: string, date: string): Promise<FocusSessionSummary[]> {
  const rows = await db
    .select({
      id: t.focusSessions.id,
      label: t.focusSessions.label,
      startedAt: t.focusSessions.startedAt,
      focusedMin: t.focusSessions.focusedMin,
      quality: t.focusSessions.quality,
      color: t.goals.color,
    })
    .from(t.focusSessions)
    .leftJoin(t.goals, eq(t.goals.id, t.focusSessions.goalId))
    .where(and(eq(t.focusSessions.userId, userId), eq(t.focusSessions.date, date), isNotNull(t.focusSessions.endedAt)))
    .orderBy(asc(t.focusSessions.startedAt));
  return rows;
}

const STALE_MS = 12 * 3_600_000;

/** The latest unfinished session started in the last 12 hours, if any. */
export async function getActiveSession(userId: string) {
  const row = await db
    .select({
      id: t.focusSessions.id,
      label: t.focusSessions.label,
      goalId: t.focusSessions.goalId,
      taskId: t.focusSessions.taskId,
      blockId: t.focusSessions.blockId,
      startedAt: t.focusSessions.startedAt,
      plannedMin: t.focusSessions.plannedMin,
      color: t.goals.color,
    })
    .from(t.focusSessions)
    .leftJoin(t.goals, eq(t.goals.id, t.focusSessions.goalId))
    .where(
      and(
        eq(t.focusSessions.userId, userId),
        isNull(t.focusSessions.endedAt),
        gte(t.focusSessions.startedAt, Date.now() - STALE_MS),
      ),
    )
    .orderBy(desc(t.focusSessions.startedAt))
    .get();
  return row ?? null;
}
