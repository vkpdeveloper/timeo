"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getExerciseHistory, ownExercise, ownWorkout, type ExerciseHistory } from "@/lib/fitness";
import { clamp } from "@/lib/form";

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

/** Inserts or updates one set (ids are generated on the client). */
export async function saveSet(logId: string, s: SetInput) {
  const user = await requireUser();
  if (!UUID.test(s.id)) throw new Error("Bad set id");
  const [log] = await Promise.all([ownWorkout(user.id, logId), ownExercise(user.id, s.exerciseId)]);
  const values = {
    exerciseId: s.exerciseId,
    exerciseOrder: clamp(Math.round(s.exerciseOrder), 0, 999),
    setIndex: clamp(Math.round(s.setIndex), 0, 999),
    warmup: !!s.warmup,
    reps: cleanNum(s.reps, 10000, 0),
    weightKg: cleanNum(s.weightKg, 2000),
    note: typeof s.note === "string" && s.note.trim() ? s.note.trim().slice(0, 300) : null,
    done: !!s.done,
  };
  // Never let an id from another workout be overwritten
  const existing = await db.select({ log: t.setLogs.workoutLogId }).from(t.setLogs).where(eq(t.setLogs.id, s.id)).get();
  if (existing && existing.log !== log.id) throw new Error("Set not found");
  if (existing) await db.update(t.setLogs).set(values).where(eq(t.setLogs.id, s.id));
  else await db.insert(t.setLogs).values({ id: s.id, workoutLogId: log.id, ...values });
}

export async function deleteSet(logId: string, setId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  await db.delete(t.setLogs).where(and(eq(t.setLogs.id, setId), eq(t.setLogs.workoutLogId, log.id)));
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
      endedAt: log.status === "in_progress" || !log.endedAt ? Date.now() : log.endedAt,
      feeling: input.feeling != null ? clamp(Math.round(input.feeling), 1, 5) : null,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
    })
    .where(eq(t.workoutLogs.id, log.id));
  refresh();
  redirect(`/fitness/history/${log.id}`);
}

export async function discardWorkout(logId: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  await db.delete(t.workoutLogs).where(eq(t.workoutLogs.id, log.id));
  refresh();
  redirect("/fitness");
}

export async function renameWorkout(logId: string, name: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, logId);
  const clean = name.trim().slice(0, 80);
  if (!clean) return;
  await db.update(t.workoutLogs).set({ name: clean }).where(eq(t.workoutLogs.id, log.id));
}
