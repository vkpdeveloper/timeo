"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { MUSCLE_GROUPS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ownExercise } from "@/lib/fitness";
import type { ExerciseOption } from "@/lib/fitness-math";
import { bool, oneOf, reqStr, str } from "@/lib/form";

function readExercise(fd: FormData) {
  return {
    name: reqStr(fd, "name", 80),
    muscle: oneOf(fd, "muscle", MUSCLE_GROUPS, "full_body"),
    equipment: str(fd, "equipment")?.slice(0, 60) ?? null,
    type: oneOf(fd, "type", ["weight", "bodyweight", "cardio"] as const, "weight"),
    weightBasis: oneOf(fd, "weightBasis", ["total", "per_hand", "per_arm"] as const, "total"),
    unilateral: bool(fd, "unilateral"),
    cues: str(fd, "cues")?.slice(0, 500) ?? null,
  };
}

/** Creates a custom exercise (or returns the existing one with the same name). */
export async function createExercise(fd: FormData): Promise<ExerciseOption> {
  const user = await requireUser();
  const values = readExercise(fd);
  const existing = await db
    .select()
    .from(t.exercises)
    .where(and(eq(t.exercises.userId, user.id), sql`lower(${t.exercises.name}) = lower(${values.name})`))
    .get();
  const row =
    existing ??
    (await db
      .insert(t.exercises)
      .values({ userId: user.id, ...values })
      .returning()
      .get());
  refresh();
  return {
    id: row.id,
    name: row.name,
    muscle: row.muscle,
    equipment: row.equipment,
    type: row.type,
    weightBasis: row.weightBasis,
    unilateral: row.unilateral,
  };
}

export async function updateExercise(fd: FormData) {
  const user = await requireUser();
  const ex = await ownExercise(user.id, reqStr(fd, "id"));
  await db.update(t.exercises).set(readExercise(fd)).where(eq(t.exercises.id, ex.id));
  refresh();
}
