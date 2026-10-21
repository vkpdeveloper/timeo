"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { GOAL_AREAS, GOAL_STATUSES, GOAL_TIERS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DEFAULT_COLOR, isPaletteColor } from "@/lib/colors";
import { addDays, isValidISODate, nowMinIn, startOfWeek } from "@/lib/dates";
import { clamp, date, int, num, oneOf, reqStr, str } from "@/lib/form";
import { getActiveSeason, ownGoalId, seasonEndFor } from "@/lib/queries";
import { findFreeSlot } from "@/lib/schedule";

// ─────────────────────────── Season setup ───────────────────────────

export type SeasonDraft = {
  name: string;
  intention: string;
  startDate: string;
  capacityHours: number;
  brainDump: string;
  goals: {
    title: string;
    outcome: string;
    why?: string;
    tier: (typeof GOAL_TIERS)[number];
    area: (typeof GOAL_AREAS)[number];
    color: string;
    weeklyHours: number;
    system: string;
    milestones: { title: string; dueDate: string | null }[];
  }[];
};

const cut = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;

/** Wizard finish: archives the active season and creates the new one with its goals and milestones. */
export async function createSeason(draft: SeasonDraft) {
  const user = await requireUser();
  const name = cut(draft.name, 80) || "New season";
  const startDate = isValidISODate(draft.startDate) ? draft.startDate : user.today;
  const goals = (Array.isArray(draft.goals) ? draft.goals : []).filter((g) => cut(g?.title, 200)).slice(0, 12);

  const seasonId = crypto.randomUUID();
  const goalRows = goals.map((g, i) => ({
    id: crypto.randomUUID(),
    userId: user.id,
    seasonId,
    title: cut(g.title, 200),
    outcome: cut(g.outcome, 500) || null,
    why: cut(g.why, 500) || null,
    tier: pick(g.tier, GOAL_TIERS, "core"),
    area: pick(g.area, GOAL_AREAS, "work"),
    color: isPaletteColor(g.color) ? g.color : DEFAULT_COLOR,
    weeklyHours: clamp(Number(g.weeklyHours) || 0, 0, 80),
    system: cut(g.system, 300) || null,
    sortOrder: i,
  }));
  const milestoneRows = goals.flatMap((g, i) =>
    (Array.isArray(g.milestones) ? g.milestones : [])
      .filter((m) => cut(m?.title, 200))
      .slice(0, 20)
      .map((m, j) => ({
        userId: user.id,
        goalId: goalRows[i].id,
        title: cut(m.title, 200),
        dueDate: isValidISODate(m.dueDate) ? m.dueDate : null,
        sortOrder: j,
      })),
  );

  await db
    .update(t.seasons)
    .set({ status: "archived" })
    .where(and(eq(t.seasons.userId, user.id), eq(t.seasons.status, "active")));
  await db.insert(t.seasons).values({
    id: seasonId,
    userId: user.id,
    name,
    intention: cut(draft.intention, 300) || null,
    startDate,
    endDate: seasonEndFor(startDate),
    brainDump: cut(draft.brainDump, 10_000) || null,
    weeklyCapacityHours: clamp(Math.round(Number(draft.capacityHours) || 15), 1, 100),
  });
  if (goalRows.length) await db.insert(t.goals).values(goalRows);
  if (milestoneRows.length) await db.insert(t.milestones).values(milestoneRows);
  redirect("/app/goals");
}

export async function updateSeason(fd: FormData) {
  const user = await requireUser();
  await db
    .update(t.seasons)
    .set({
      name: reqStr(fd, "name", 80),
      intention: str(fd, "intention"),
      weeklyCapacityHours: clamp(int(fd, "capacity") ?? 15, 1, 100),
    })
    .where(and(eq(t.seasons.id, reqStr(fd, "id")), eq(t.seasons.userId, user.id)));
  refresh();
}

// ─────────────────────────── Goals ───────────────────────────

function goalFields(fd: FormData) {
  const color = str(fd, "color");
  return {
    title: reqStr(fd, "title", 200),
    outcome: str(fd, "outcome"),
    why: str(fd, "why"),
    system: str(fd, "system"),
    tier: oneOf(fd, "tier", GOAL_TIERS, "core"),
    area: oneOf(fd, "area", GOAL_AREAS, "work"),
    color: isPaletteColor(color) ? color : DEFAULT_COLOR,
    weeklyHours: clamp(num(fd, "weeklyHours") ?? 3, 0, 80),
  };
}

export async function createGoal(fd: FormData) {
  const user = await requireUser();
  const season = await getActiveSeason(user.id);
  if (!season) throw new Error("Start a season first");
  await db.insert(t.goals).values({ userId: user.id, seasonId: season.id, sortOrder: 99, ...goalFields(fd) });
  refresh();
}

export async function updateGoal(fd: FormData) {
  const user = await requireUser();
  const id = await ownGoalId(user.id, reqStr(fd, "id"));
  await db.update(t.goals).set(goalFields(fd)).where(eq(t.goals.id, id!));
  refresh();
}

export async function setGoalComplete(goalId: string, done: boolean) {
  const user = await requireUser();
  const id = await ownGoalId(user.id, goalId);
  await db.update(t.goals).set({ completedAt: done ? Date.now() : null }).where(eq(t.goals.id, id!));
  refresh();
}

export async function deleteGoal(goalId: string) {
  const user = await requireUser();
  const id = await ownGoalId(user.id, goalId);
  await db.delete(t.goals).where(eq(t.goals.id, id!));
  redirect("/app/goals");
}

/** Check in: a dated status update on the goal's trajectory. Also sets goals.status. */
export async function addGoalUpdate(fd: FormData) {
  const user = await requireUser();
  const goalId = await ownGoalId(user.id, reqStr(fd, "goalId"));
  const status = oneOf(fd, "status", GOAL_STATUSES, "on_track");
  const d = date(fd, "date") ?? user.today;
  const confidence = int(fd, "confidence");
  await db.insert(t.goalUpdates).values({
    userId: user.id,
    goalId: goalId!,
    date: d,
    weekStart: startOfWeek(d),
    status,
    confidence: confidence == null ? null : clamp(confidence, 0, 100),
    note: str(fd, "note"),
  });
  await db.update(t.goals).set({ status }).where(eq(t.goals.id, goalId!));
  refresh();
}

export async function deleteGoalUpdate(id: string) {
  const user = await requireUser();
  await db.delete(t.goalUpdates).where(and(eq(t.goalUpdates.id, id), eq(t.goalUpdates.userId, user.id)));
  refresh();
}

// ─────────────────────────── Milestones ───────────────────────────

export async function createMilestone(fd: FormData) {
  const user = await requireUser();
  const goalId = await ownGoalId(user.id, reqStr(fd, "goalId"));
  await db.insert(t.milestones).values({
    userId: user.id,
    goalId: goalId!,
    title: reqStr(fd, "title", 200),
    dueDate: date(fd, "dueDate"),
  });
  refresh();
}

export async function updateMilestone(fd: FormData) {
  const user = await requireUser();
  await db
    .update(t.milestones)
    .set({ title: reqStr(fd, "title", 200), dueDate: date(fd, "dueDate") })
    .where(and(eq(t.milestones.id, reqStr(fd, "id")), eq(t.milestones.userId, user.id)));
  refresh();
}

export async function setMilestoneDone(id: string, done: boolean) {
  const user = await requireUser();
  await db
    .update(t.milestones)
    .set({ doneAt: done ? Date.now() : null })
    .where(and(eq(t.milestones.id, id), eq(t.milestones.userId, user.id)));
  refresh();
}

export async function deleteMilestone(id: string) {
  const user = await requireUser();
  await db.delete(t.milestones).where(and(eq(t.milestones.id, id), eq(t.milestones.userId, user.id)));
  refresh();
}

// ─────────────────────────── Coach actions ───────────────────────────

/**
 * Coach "Schedule it": puts a weekly step on the calendar in the first free
 * slot today (if there is room left) or tomorrow.
 */
export async function scheduleStep(taskId: string) {
  const user = await requireUser();
  const task = await db
    .select()
    .from(t.tasks)
    .where(and(eq(t.tasks.id, taskId), eq(t.tasks.userId, user.id)))
    .get();
  if (!task) throw new Error("Task not found");
  const minutes = clamp(task.estimateMin ?? 60, 15, 240);
  const dayStart = Math.max(user.dayStartMin, 8 * 60);
  const dayEnd = Math.min(user.dayEndMin, 21 * 60);
  const nowMin = Math.ceil(nowMinIn(user.timezone) / 15) * 15 + 15;

  const days = [user.today, addDays(user.today, 1), addDays(user.today, 2)];
  const busy = await db
    .select({ date: t.blocks.date, startMin: t.blocks.startMin, endMin: t.blocks.endMin })
    .from(t.blocks)
    .where(and(eq(t.blocks.userId, user.id), inArray(t.blocks.date, days)));

  for (const day of days) {
    const start = day === user.today ? Math.max(dayStart, nowMin) : dayStart;
    const slot = findFreeSlot(busy.filter((b) => b.date === day), minutes, start, dayEnd);
    if (!slot) continue;
    await db.insert(t.blocks).values({
      userId: user.id,
      goalId: task.goalId,
      taskId: task.id,
      title: task.title,
      kind: "focus",
      date: day,
      startMin: slot.start,
      endMin: slot.end,
    });
    refresh();
    return { ok: true as const, date: day, start: slot.start, end: slot.end };
  }
  return { ok: false as const, message: "No free slot in the next days" };
}
