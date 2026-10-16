"use server";

import { and, desc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { GOAL_STATUSES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays, weekday } from "@/lib/dates";
import { clamp, date, int, oneOf, reqStr, str } from "@/lib/form";
import { ownGoalId } from "@/lib/queries";

const text = (fd: FormData, key: string) => str(fd, key)?.slice(0, 1000) ?? null;
const scale = (fd: FormData, key: string) => {
  const n = int(fd, key);
  return n == null ? null : clamp(n, 1, 5);
};

function readWeekStart(fd: FormData, today: string) {
  const ws = date(fd, "weekStart");
  if (!ws || weekday(ws) !== 0) throw new Error("Pick a week");
  if (ws > today) throw new Error("That week hasn't started");
  return ws;
}

/** Evening reflection: one row per day. */
export async function saveDailyReflection(fd: FormData) {
  const user = await requireUser();
  const day = date(fd, "date") ?? user.today;
  if (day > user.today) throw new Error("That day hasn't happened yet");
  const values = {
    mood: scale(fd, "mood"),
    energy: scale(fd, "energy"),
    wins: text(fd, "wins"),
    slipped: text(fd, "slipped"),
    next: text(fd, "next"),
  };
  await db
    .insert(t.reflections)
    .values({ userId: user.id, kind: "daily", date: day, ...values })
    .onConflictDoUpdate({ target: [t.reflections.userId, t.reflections.kind, t.reflections.date], set: values });
  refresh();
}

/** Weekly assessment of one goal; also sets the goal's current status when this is its latest week. */
export async function saveGoalUpdate(fd: FormData) {
  const user = await requireUser();
  const goalId = await ownGoalId(user.id, reqStr(fd, "goalId"));
  if (!goalId) throw new Error("Goal not found");
  const weekStart = readWeekStart(fd, user.today);
  const status = oneOf(fd, "status", GOAL_STATUSES, "on_track");
  const confidenceRaw = int(fd, "confidence");
  const values = {
    status,
    confidence: confidenceRaw == null ? null : clamp(confidenceRaw, 0, 100),
    note: text(fd, "note"),
    // dated on the review day, or the Sunday when reviewing a past week
    date: [user.today, addDays(weekStart, 6)].sort()[0],
  };

  const existing = await db
    .select({ id: t.goalUpdates.id })
    .from(t.goalUpdates)
    .where(and(eq(t.goalUpdates.userId, user.id), eq(t.goalUpdates.goalId, goalId), eq(t.goalUpdates.weekStart, weekStart)))
    .get();
  if (existing) await db.update(t.goalUpdates).set(values).where(eq(t.goalUpdates.id, existing.id));
  else await db.insert(t.goalUpdates).values({ userId: user.id, goalId, weekStart, ...values });

  const latest = await db
    .select({ weekStart: t.goalUpdates.weekStart })
    .from(t.goalUpdates)
    .where(and(eq(t.goalUpdates.userId, user.id), eq(t.goalUpdates.goalId, goalId)))
    .orderBy(desc(t.goalUpdates.weekStart))
    .get();
  if (!latest || latest.weekStart <= weekStart) {
    await db.update(t.goals).set({ status }).where(and(eq(t.goals.id, goalId), eq(t.goals.userId, user.id)));
  }
  refresh();
}

/** Weekly reflection: one row per week (keyed by its Monday). */
export async function saveWeeklyReflection(fd: FormData) {
  const user = await requireUser();
  const weekStart = readWeekStart(fd, user.today);
  // only overwrite the fields this form step sent
  const keys = ["wins", "slipped", "learned", "energisers", "drainers", "next"] as const;
  const values: Partial<Record<(typeof keys)[number], string | null>> = {};
  for (const k of keys) if (fd.has(k)) values[k] = text(fd, k);
  await db
    .insert(t.reflections)
    .values({ userId: user.id, kind: "weekly", date: weekStart, ...values })
    .onConflictDoUpdate({
      target: [t.reflections.userId, t.reflections.kind, t.reflections.date],
      set: Object.keys(values).length ? values : { date: weekStart },
    });
  refresh();
}
