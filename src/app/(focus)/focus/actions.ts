"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { clamp } from "@/lib/form";
import { FOCUS_MAX, FOCUS_MIN, focusQuality } from "@/lib/focus";
import { ownGoalId, ownTaskId } from "@/lib/queries";
import { listDaySessions } from "./data";

async function ownBlock(userId: string, blockId: string | null | undefined) {
  if (!blockId) return null;
  const b = await db
    .select({ id: t.blocks.id, goalId: t.blocks.goalId, taskId: t.blocks.taskId })
    .from(t.blocks)
    .where(and(eq(t.blocks.id, blockId), eq(t.blocks.userId, userId)))
    .get();
  if (!b) throw new Error("Block not found");
  return b;
}

/** Creates the session row the moment the timer starts. */
export async function startFocus(input: {
  label: string;
  plannedMin: number;
  goalId?: string | null;
  taskId?: string | null;
  blockId?: string | null;
}) {
  const user = await requireUser();
  const label = String(input.label ?? "").trim().slice(0, 120);
  if (!label) throw new Error("Pick something to focus on");
  const plannedMin = clamp(Math.round(Number(input.plannedMin) || 25), FOCUS_MIN, FOCUS_MAX);
  const block = await ownBlock(user.id, input.blockId);
  const taskId = await ownTaskId(user.id, input.taskId ?? block?.taskId ?? null);
  let goalId = await ownGoalId(user.id, input.goalId ?? block?.goalId ?? null);
  if (!goalId && taskId) {
    const task = await db.select({ goalId: t.tasks.goalId }).from(t.tasks).where(eq(t.tasks.id, taskId)).get();
    goalId = task?.goalId ?? null;
  }

  // Starting a new session abandons any unfinished one (it was never saved).
  await db.delete(t.focusSessions).where(and(eq(t.focusSessions.userId, user.id), isNull(t.focusSessions.endedAt)));

  const startedAt = Date.now();
  const [row] = await db
    .insert(t.focusSessions)
    .values({
      userId: user.id,
      goalId,
      taskId,
      blockId: block?.id ?? null,
      label,
      date: user.today,
      startedAt,
      plannedMin,
    })
    .returning({ id: t.focusSessions.id });
  refresh();
  return { id: row.id, startedAt, goalId, taskId, blockId: block?.id ?? null, plannedMin };
}

/** Saves the reflection and computed quality; optionally marks the source block done. */
export async function finishFocus(input: {
  id: string;
  endedAt: number;
  plannedMin: number;
  focusedMin: number;
  pauses: number;
  rating: number | null;
  energy: number | null;
  blockers?: string | null;
  notes?: string | null;
  markBlockDone?: boolean;
}) {
  const user = await requireUser();
  const s = await db
    .select()
    .from(t.focusSessions)
    .where(and(eq(t.focusSessions.id, input.id), eq(t.focusSessions.userId, user.id)))
    .get();
  if (!s) throw new Error("Session not found");

  const plannedMin = clamp(Math.round(Number(input.plannedMin) || s.plannedMin), FOCUS_MIN, FOCUS_MAX + 120);
  const endedAt = clamp(Math.round(Number(input.endedAt) || Date.now()), s.startedAt, Date.now());
  // focused time can never exceed wall-clock time since the start
  const wallMin = Math.floor((endedAt - s.startedAt) / 60_000);
  const focusedMin = clamp(Math.round(Number(input.focusedMin) || 0), 0, Math.max(0, wallMin + 1));
  const pauses = clamp(Math.round(Number(input.pauses) || 0), 0, 99);
  const rating = input.rating == null ? null : clamp(Math.round(input.rating), 1, 5);
  const energy = input.energy == null ? null : clamp(Math.round(input.energy), -2, 2);
  const quality = focusQuality({ focusedMin, plannedMin, rating, pauses });
  const text = (v: string | null | undefined) => {
    const x = (v ?? "").trim();
    return x ? x.slice(0, 1000) : null;
  };

  await db
    .update(t.focusSessions)
    .set({
      endedAt,
      plannedMin,
      focusedMin,
      pauses,
      rating,
      energy,
      quality,
      blockers: text(input.blockers),
      notes: text(input.notes),
    })
    .where(eq(t.focusSessions.id, s.id));

  if (input.markBlockDone && s.blockId) {
    await db
      .update(t.blocks)
      .set({ doneAt: Date.now(), skippedAt: null })
      .where(and(eq(t.blocks.id, s.blockId), eq(t.blocks.userId, user.id)));
  }

  const sessions = await listDaySessions(user.id, s.date);
  refresh();
  return { quality, focusedMin, sessions };
}

export async function discardFocus(id: string) {
  const user = await requireUser();
  await db.delete(t.focusSessions).where(and(eq(t.focusSessions.id, id), eq(t.focusSessions.userId, user.id)));
  refresh();
}
