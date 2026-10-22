"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { db, t } from "@/db";
import { BLOCK_KINDS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { syncBlockTask } from "@/lib/block-task";
import { addDays, isValidISODate } from "@/lib/dates";
import { pushTaskChanges } from "@/lib/integrations/sync";
import { clamp, date, oneOf, reqStr, str, time } from "@/lib/form";
import { ownGoalId, ownTaskId } from "@/lib/queries";
import { findFreeSlot } from "@/lib/schedule";

/** Events from a connected calendar are changed there; the next sync would undo it here. */
const SYNCED = "Change this event in its calendar";

function readTimes(fd: FormData) {
  const start = time(fd, "start");
  const end = time(fd, "end");
  if (start == null || end == null) throw new Error("Pick a start and end time");
  // allow blocks that end at midnight
  const endMin = end <= start ? (end === 0 ? 24 * 60 : start + 30) : end;
  return { startMin: start, endMin };
}

export async function createBlock(fd: FormData) {
  const user = await requireUser();
  const { startMin, endMin } = readTimes(fd);
  await db.insert(t.blocks).values({
    userId: user.id,
    title: reqStr(fd, "title", 120),
    kind: oneOf(fd, "kind", BLOCK_KINDS, "focus"),
    goalId: await ownGoalId(user.id, str(fd, "goalId")),
    taskId: await ownTaskId(user.id, str(fd, "taskId")),
    date: date(fd, "date") ?? user.today,
    startMin,
    endMin,
    protected: str(fd, "protected") === "1",
  });
  refresh();
}

export async function updateBlock(fd: FormData) {
  const user = await requireUser();
  const id = reqStr(fd, "id");
  const existing = await db
    .select()
    .from(t.blocks)
    .where(and(eq(t.blocks.id, id), eq(t.blocks.userId, user.id)))
    .get();
  if (!existing) throw new Error("Block not found");
  if (existing.integrationId) throw new Error(SYNCED);
  const { startMin, endMin } = readTimes(fd);
  const newDate = date(fd, "date") ?? existing.date;
  const moved = newDate !== existing.date || startMin !== existing.startMin;
  await db
    .update(t.blocks)
    .set({
      title: reqStr(fd, "title", 120),
      kind: oneOf(fd, "kind", BLOCK_KINDS, existing.kind),
      goalId: await ownGoalId(user.id, str(fd, "goalId")),
      date: newDate,
      startMin,
      endMin,
      rescheduleCount: existing.rescheduleCount + (moved ? 1 : 0),
    })
    .where(eq(t.blocks.id, id));
  refresh();
}

/** Moves a block by drag or quick action; counts as a reschedule. */
export async function moveBlock(id: string, newDate: string, rawStart: number) {
  const user = await requireUser();
  if (!isValidISODate(newDate) || !Number.isFinite(rawStart)) throw new Error("Pick a valid day and time");
  const startMin = clamp(Math.round(rawStart), 0, 24 * 60 - 1);
  const b = await db
    .select()
    .from(t.blocks)
    .where(and(eq(t.blocks.id, id), eq(t.blocks.userId, user.id)))
    .get();
  if (!b) throw new Error("Block not found");
  if (b.integrationId) throw new Error(SYNCED);
  const duration = b.endMin - b.startMin;
  await db
    .update(t.blocks)
    .set({
      date: newDate,
      startMin,
      endMin: Math.min(24 * 60, startMin + duration),
      rescheduleCount: b.rescheduleCount + 1,
    })
    .where(eq(t.blocks.id, id));
  refresh();
}

async function ownBlock(userId: string, id: string) {
  const b = await db
    .select()
    .from(t.blocks)
    .where(and(eq(t.blocks.id, id), eq(t.blocks.userId, userId)))
    .get();
  if (!b) throw new Error("Block not found");
  return b;
}

/** Done also closes the task the block stands for; undo reopens it. */
export async function setBlockDone(id: string, done: boolean) {
  const user = await requireUser();
  const b = await ownBlock(user.id, id);
  const doneAt = done ? Date.now() : null;
  await db.update(t.blocks).set({ doneAt, skippedAt: null }).where(eq(t.blocks.id, id));
  await syncBlockTask(user.id, b, doneAt);
  // the task it stands for may come from a connected app
  if (b.taskId) after(() => pushTaskChanges(user.id));
  refresh();
}

export async function skipBlock(id: string) {
  const user = await requireUser();
  const b = await ownBlock(user.id, id);
  await db.update(t.blocks).set({ skippedAt: Date.now(), doneAt: null }).where(eq(t.blocks.id, id));
  await syncBlockTask(user.id, b, null);
  if (b.taskId) after(() => pushTaskChanges(user.id));
  refresh();
}

export async function deleteBlock(id: string) {
  const user = await requireUser();
  await db.delete(t.blocks).where(and(eq(t.blocks.id, id), eq(t.blocks.userId, user.id), isNull(t.blocks.integrationId)));
  refresh();
}

/**
 * Coach action: protect a focus block for a goal in the first free slot
 * (mornings first) on the given day, defaulting to tomorrow.
 */
export async function protectTime(goalId: string, minutes = 120, day?: string) {
  const user = await requireUser();
  const gid = await ownGoalId(user.id, goalId);
  const goal = await db.select().from(t.goals).where(eq(t.goals.id, gid!)).get();
  if (!goal) throw new Error("Goal not found");

  const targetDay = day ?? addDays(user.today, 1);
  const existing = await db
    .select({ startMin: t.blocks.startMin, endMin: t.blocks.endMin })
    .from(t.blocks)
    .where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, targetDay)));
  const slot = findFreeSlot(existing, minutes, Math.max(user.dayStartMin, 8 * 60), Math.min(user.dayEndMin, 21 * 60));
  if (!slot) return { ok: false as const, message: "No free slot that day" };

  await db.insert(t.blocks).values({
    userId: user.id,
    goalId: goal.id,
    title: `Deep work: ${goal.title}`,
    kind: "focus",
    date: targetDay,
    startMin: slot.start,
    endMin: slot.end,
    protected: true,
  });
  refresh();
  return { ok: true as const, date: targetDay, start: slot.start, end: slot.end };
}
