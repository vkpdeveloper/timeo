"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getExerciseHistory, ownWorkout, type ExerciseHistory } from "@/lib/fitness";
import { clamp } from "@/lib/form";
import { trainedMs } from "@/lib/fitness-math";

// The logger owns its state on the client, so the high-frequency set actions
// below skip refresh(): re-rendering the page on every keystroke is wasted work.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetInput = {
  id: string;
  exerciseId: string;
  exerciseOrder: number;
  setIndex: number;
  warmup: boolean;
  reps: number | null;
  weightKg: number | null;
  note: string | null;
  done: boolean;
};

const cleanNum = (n: unknown, max: number, decimals = 2) => {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return clamp(Math.round(n * f) / f, 0, max);
};

/**
 * Inserts or updates one set (ids are generated on the client). One guarded
 * statement: it only writes when the workout and exercise belong to the user,
 * and never moves a set id across workouts.
 */
export async function saveSet(logId: string, s: SetInput) {
  const user = await requireUser();
  if (!UUID.test(s.id)) throw new Error("Bad set id");
  const v = {
    exerciseOrder: clamp(Math.round(Number(s.exerciseOrder) || 0), 0, 999),
    setIndex: clamp(Math.round(Number(s.setIndex) || 0), 0, 999),
    warmup: s.warmup ? 1 : 0,
    reps: cleanNum(s.reps, 10000, 0),
    weightKg: cleanNum(s.weightKg, 2000),
    note: typeof s.note === "string" && s.note.trim() ? s.note.trim().slice(0, 300) : null,
    done: s.done ? 1 : 0,
  };
  await db.run(sql`
    insert into set_logs (id, workout_log_id, exercise_id, exercise_order, set_index, warmup, reps, weight_kg, note, done)
    select ${s.id}, ${logId}, ${s.exerciseId}, ${v.exerciseOrder}, ${v.setIndex}, ${v.warmup}, ${v.reps}, ${v.weightKg}, ${v.note}, ${v.done}
    where exists (select 1 from workout_logs where id = ${logId} and user_id = ${user.id})
      and exists (select 1 from exercises where id = ${s.exerciseId} and user_id = ${user.id})
    on conflict(id) do update set
      exercise_id = excluded.exercise_id, exercise_order = excluded.exercise_order, set_index = excluded.set_index,
      warmup = excluded.warmup, reps = excluded.reps, weight_kg = excluded.weight_kg, note = excluded.note, done = excluded.done
    where set_logs.workout_log_id = excluded.workout_log_id
  `);
}

export async function deleteSet(logId: string, setId: string) {
  const user = await requireUser();
  await db.run(sql`
    delete from set_logs where id = ${setId} and workout_log_id = ${logId}
      and exists (select 1 from workout_logs where id = ${logId} and user_id = ${user.id})
  `);
}

/** Rewrites exercise order/assignment of all sets in one go (move, replace, remove). */
export async function syncBlocks(logId: string, blocks: { exerciseId: string; setIds: string[] }[]) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  const exIds = [...new Set(blocks.map((b) => b.exerciseId))];
  if (exIds.length) {
    const owned = await db
      .select({ id: t.exercises.id })
      .from(t.exercises)
      .where(and(eq(t.exercises.userId, user.id), inArray(t.exercises.id, exIds)));
    if (owned.length !== exIds.length) throw new Error("Exercise not found");
  }
  const keep = blocks.flatMap((b) => b.setIds);
  const current = await db.select({ id: t.setLogs.id }).from(t.setLogs).where(eq(t.setLogs.workoutLogId, log.id));
  const drop = current.map((c) => c.id).filter((id) => !keep.includes(id));
  const stmts = blocks.flatMap((b, order) =>
    b.setIds.map((id, i) =>
      db
        .update(t.setLogs)
        .set({ exerciseId: b.exerciseId, exerciseOrder: order, setIndex: i })
        .where(and(eq(t.setLogs.id, id), eq(t.setLogs.workoutLogId, log.id))),
    ),
  );
  if (drop.length) {
    await db.delete(t.setLogs).where(and(eq(t.setLogs.workoutLogId, log.id), inArray(t.setLogs.id, drop)));
  }
  if (stmts.length) await db.batch(stmts as [typeof stmts[number], ...typeof stmts]);
}

/** Last session and bests for an exercise just added to the logger. */
export async function exerciseHistory(logId: string, exerciseId: string): Promise<ExerciseHistory | null> {
  const user = await requireUser();
  await ownWorkout(user.id, logId);
  const map = await getExerciseHistory(user.id, [exerciseId], logId);
  return map.get(exerciseId) ?? null;
}

export async function finishWorkout(logId: string, input: { feeling: number | null; notes: string | null }) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  await db.delete(t.setLogs).where(and(eq(t.setLogs.workoutLogId, log.id), eq(t.setLogs.done, false)));
  await db
    .update(t.workoutLogs)
    .set({
      status: "completed",
      skipReason: null,
      endedAt: log.status === "in_progress" || !log.endedAt ? log.startedAt + trainedMs(log, Date.now()) : log.endedAt,
      pausedAt: null,
      feeling: input.feeling != null ? clamp(Math.round(input.feeling), 1, 5) : null,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
    })
    .where(eq(t.workoutLogs.id, log.id));
  refresh();
  redirect(`/app/fitness/history/${log.id}`);
}

/** Stops the workout clock; the workout stays open. Returns the stored clock. */
export async function pauseWorkout(logId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  if (log.status !== "in_progress" || log.pausedAt != null) return { pausedAt: log.pausedAt, pausedMs: log.pausedMs };
  const pausedAt = Date.now();
  await db.update(t.workoutLogs).set({ pausedAt }).where(eq(t.workoutLogs.id, log.id));
  return { pausedAt, pausedMs: log.pausedMs };
}

export async function resumeWorkout(logId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  if (log.status !== "in_progress" || log.pausedAt == null) return { pausedAt: log.pausedAt, pausedMs: log.pausedMs };
  const pausedMs = log.pausedMs + Math.max(0, Date.now() - log.pausedAt);
  await db.update(t.workoutLogs).set({ pausedAt: null, pausedMs }).where(eq(t.workoutLogs.id, log.id));
  return { pausedAt: null, pausedMs };
}

export async function discardWorkout(logId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  await db.delete(t.workoutLogs).where(eq(t.workoutLogs.id, log.id));
  refresh();
  redirect("/app/fitness");
}

export async function renameWorkout(logId: string, name: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  const clean = name.trim().slice(0, 80);
  if (!clean) return;
  await db.update(t.workoutLogs).set({ name: clean }).where(eq(t.workoutLogs.id, log.id));
}
