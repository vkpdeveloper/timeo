"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { isValidISODate, weekday } from "@/lib/dates";
import { ownTemplate, ownWorkout } from "@/lib/fitness";
import { date as fdDate, oneOf, str } from "@/lib/form";

async function scheduledFor(userId: string, day: string) {
  return db
    .select({ templateId: t.gymSchedule.templateId, label: t.gymSchedule.label, name: t.workoutTemplates.name })
    .from(t.gymSchedule)
    .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
    .where(and(eq(t.gymSchedule.userId, userId), eq(t.gymSchedule.weekday, weekday(day))))
    .get();
}

/** Logs with no sets on a day, e.g. a "skipped" or "done, not logged" mark. */
async function emptyMarks(userId: string, day: string) {
  const logs = await db
    .select({
      id: t.workoutLogs.id,
      status: t.workoutLogs.status,
      sets: sql<number>`(select count(*) from ${t.setLogs} where ${t.setLogs.workoutLogId} = ${t.workoutLogs.id})`,
    })
    .from(t.workoutLogs)
    .where(
      and(
        eq(t.workoutLogs.userId, userId),
        eq(t.workoutLogs.date, day),
        inArray(t.workoutLogs.status, ["skipped", "unlogged"]),
      ),
    );
  return logs.filter((l) => Number(l.sets) === 0);
}

/**
 * Starts a workout from a routine (or an empty one), pre-creating its sets, and
 * opens the logger. Resumes an in-progress session of the same routine that day.
 */
export async function startWorkout(templateId: string | null, day?: string) {
  const user = await requireUser();
  const date = day && isValidISODate(day) ? day : user.today;
  const template = templateId ? await ownTemplate(user.id, templateId) : null;

  const [scheduled, open, marks] = await Promise.all([
    scheduledFor(user.id, date),
    db
      .select({ id: t.workoutLogs.id, templateId: t.workoutLogs.templateId })
      .from(t.workoutLogs)
      .where(and(eq(t.workoutLogs.userId, user.id), eq(t.workoutLogs.date, date), eq(t.workoutLogs.status, "in_progress"))),
    emptyMarks(user.id, date),
  ]);
  const resume = open.find((l) => l.templateId === (template?.id ?? null));
  if (resume) redirect(`/fitness/workout/${resume.id}`);

  const exercises = template
    ? await db
        .select()
        .from(t.templateExercises)
        .where(eq(t.templateExercises.templateId, template.id))
        .orderBy(asc(t.templateExercises.sortOrder))
    : [];

  const values = {
    userId: user.id,
    templateId: template?.id ?? null,
    plannedTemplateId: scheduled?.templateId ?? null,
    name: template?.name ?? "Workout",
    date,
    status: "in_progress" as const,
    skipReason: null,
    startedAt: Date.now(),
    endedAt: null,
  };
  let id: string;
  const reuse = marks[0];
  if (reuse) {
    id = reuse.id;
    await db.update(t.workoutLogs).set(values).where(eq(t.workoutLogs.id, id));
  } else {
    id = crypto.randomUUID();
    await db.insert(t.workoutLogs).values({ id, ...values });
  }
  const sets = exercises.flatMap((e, order) =>
    Array.from({ length: Math.max(1, e.sets) }, (_, i) => ({
      workoutLogId: id,
      exerciseId: e.exerciseId,
      exerciseOrder: order,
      setIndex: i,
      weightKg: null,
      reps: null,
    })),
  );
  if (sets.length) await db.insert(t.setLogs).values(sets);
  redirect(`/fitness/workout/${id}`);
}

/** Marks a day as skipped (with a reason) or done without logged sets. */
export async function markDay(fd: FormData) {
  const user = await requireUser();
  const date = fdDate(fd, "date") ?? user.today;
  const status = oneOf(fd, "status", ["skipped", "unlogged"] as const, "skipped");
  const reason = status === "skipped" ? (str(fd, "reason")?.slice(0, 300) ?? null) : null;
  const notes = str(fd, "notes")?.slice(0, 1000) ?? null;
  const scheduled = await scheduledFor(user.id, date);
  const chosen = str(fd, "templateId");
  const template = chosen ? await ownTemplate(user.id, chosen) : null;
  const templateId = status === "skipped" ? (scheduled?.templateId ?? null) : (template?.id ?? scheduled?.templateId ?? null);
  const name =
    status === "skipped"
      ? (scheduled?.name ?? scheduled?.label ?? "Workout")
      : (template?.name ?? scheduled?.name ?? "Workout");

  const marks = await emptyMarks(user.id, date);
  const values = {
    status,
    skipReason: reason,
    templateId,
    plannedTemplateId: scheduled?.templateId ?? null,
    name,
    notes,
  };
  if (marks[0]) {
    await db.update(t.workoutLogs).set(values).where(eq(t.workoutLogs.id, marks[0].id));
  } else {
    await db.insert(t.workoutLogs).values({ userId: user.id, date, startedAt: Date.now(), ...values });
  }
  refresh();
}

/** Removes a set-less mark (skipped / done, not logged). */
export async function clearDayMark(logId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  if (log.status !== "skipped" && log.status !== "unlogged") throw new Error("Only marks can be cleared");
  const marks = await emptyMarks(user.id, log.date);
  if (!marks.some((m) => m.id === log.id)) throw new Error("This session has sets; delete it from History");
  await db.delete(t.workoutLogs).where(eq(t.workoutLogs.id, log.id));
  refresh();
}
