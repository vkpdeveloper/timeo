"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { isValidISODate, weekday } from "@/lib/dates";

/**
 * Turns the gym split's suggestion for a day into a real workout block
 * (the dashed "ghost" on the planner).
 */
export async function addScheduledWorkout(date: string) {
  const user = await requireUser();
  if (!isValidISODate(date)) throw new Error("Invalid date");
  const row = await db
    .select({
      templateId: t.gymSchedule.templateId,
      startMin: t.gymSchedule.startMin,
      durationMin: t.gymSchedule.durationMin,
      name: t.workoutTemplates.name,
    })
    .from(t.gymSchedule)
    .innerJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
    .where(
      and(
        eq(t.gymSchedule.userId, user.id),
        eq(t.gymSchedule.weekday, weekday(date)),
        isNotNull(t.gymSchedule.templateId),
        eq(t.workoutTemplates.userId, user.id),
      ),
    )
    .get();
  if (!row) throw new Error("No workout scheduled that day");

  const startMin = row.startMin ?? 18 * 60;
  await db.insert(t.blocks).values({
    userId: user.id,
    title: row.name,
    kind: "workout",
    workoutTemplateId: row.templateId,
    date,
    startMin,
    endMin: Math.min(24 * 60, startMin + (row.durationMin || 60)),
  });
  refresh();
}

/** Drag the bottom edge of a block: a new end time, at least 15 minutes after the start. */
export async function resizeBlock(id: string, rawEnd: number) {
  const user = await requireUser();
  if (typeof id !== "string" || !Number.isFinite(rawEnd)) throw new Error("Pick a valid time");
  const b = await db
    .select({ startMin: t.blocks.startMin, integrationId: t.blocks.integrationId })
    .from(t.blocks)
    .where(and(eq(t.blocks.id, id), eq(t.blocks.userId, user.id)))
    .get();
  if (!b) throw new Error("Block not found");
  if (b.integrationId) throw new Error("Change this event in its calendar");
  const endMin = Math.min(24 * 60, Math.max(b.startMin + 15, Math.round(rawEnd)));
  await db
    .update(t.blocks)
    .set({ endMin })
    .where(and(eq(t.blocks.id, id), eq(t.blocks.userId, user.id)));
  refresh();
}
