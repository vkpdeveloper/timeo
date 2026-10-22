"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { startOfWeek } from "@/lib/dates";
import { date, int, reqStr, str, time } from "@/lib/form";
import { forgetTask, pushTaskChanges } from "@/lib/integrations/sync";
import { ownGoalId, ownMilestoneId } from "@/lib/queries";

export async function createTask(fd: FormData) {
  const user = await requireUser();
  const goalId = await ownGoalId(user.id, str(fd, "goalId"));
  const dueDate = date(fd, "dueDate");
  const weekly = str(fd, "weekly") === "1";
  await db.insert(t.tasks).values({
    userId: user.id,
    goalId,
    milestoneId: await ownMilestoneId(user.id, str(fd, "milestoneId")),
    title: reqStr(fd, "title", 200),
    notes: str(fd, "notes"),
    dueDate,
    dueMin: time(fd, "dueTime"),
    estimateMin: int(fd, "estimateMin"),
    weekStart: weekly ? startOfWeek(dueDate ?? user.today) : null,
  });
  refresh();
}

export async function updateTask(fd: FormData) {
  const user = await requireUser();
  const id = reqStr(fd, "id");
  await db
    .update(t.tasks)
    .set({
      title: reqStr(fd, "title", 200),
      notes: str(fd, "notes"),
      goalId: await ownGoalId(user.id, str(fd, "goalId")),
      dueDate: date(fd, "dueDate"),
      dueMin: time(fd, "dueTime"),
      estimateMin: int(fd, "estimateMin"),
    })
    .where(and(eq(t.tasks.id, id), eq(t.tasks.userId, user.id)));
  refresh();
}

export async function setTaskDone(id: string, done: boolean) {
  const user = await requireUser();
  const [task] = await db
    .update(t.tasks)
    .set({ doneAt: done ? Date.now() : null })
    .where(and(eq(t.tasks.id, id), eq(t.tasks.userId, user.id)))
    .returning({ integrationId: t.tasks.integrationId });
  // checked off here, checked off in the app it came from
  if (task?.integrationId) after(() => pushTaskChanges(user.id));
  refresh();
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  const [task] = await db
    .delete(t.tasks)
    .where(and(eq(t.tasks.id, id), eq(t.tasks.userId, user.id)))
    .returning({ integrationId: t.tasks.integrationId, externalId: t.tasks.externalId });
  // an imported task stays deleted: the next sync mustn't bring it back
  if (task) await forgetTask(user.id, task);
  refresh();
}
