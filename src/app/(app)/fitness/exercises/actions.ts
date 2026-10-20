"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { MUSCLE_GROUPS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { catalogEntry, catalogIdFor } from "@/lib/exercise-catalog-server";
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
      .values({ userId: user.id, ...values, catalogId: catalogIdFor(values.name) })
      .returning()
      .get());
  refresh();
  return toOption(row);
}

const toOption = (row: typeof t.exercises.$inferSelect): ExerciseOption => ({
  id: row.id,
  name: row.name,
  muscle: row.muscle,
  equipment: row.equipment,
  type: row.type,
  weightBasis: row.weightBasis,
  unilateral: row.unilateral,
  catalogId: row.catalogId,
});

const libraryEntry = (catalogId: string) => {
  const entry = catalogEntry(catalogId);
  if (!entry) throw new Error("That exercise isn't in the library");
  return entry;
};

/** Adds a library exercise to the user's own (or returns the one they already have). */
export async function addFromCatalog(catalogId: string): Promise<ExerciseOption> {
  const user = await requireUser();
  const entry = libraryEntry(catalogId);
  const existing = await db
    .select()
    .from(t.exercises)
    .where(and(eq(t.exercises.userId, user.id), sql`(${t.exercises.catalogId} = ${entry.id} or lower(${t.exercises.name}) = lower(${entry.name}))`))
    .get();
  const row =
    existing ??
    (await db
      .insert(t.exercises)
      .values({
        userId: user.id,
        name: entry.name,
        muscle: entry.muscle as (typeof MUSCLE_GROUPS)[number],
        equipment: entry.equipment,
        type: entry.type,
        weightBasis: entry.weightBasis,
        unilateral: entry.unilateral,
        catalogId: entry.id,
      })
      .returning()
      .get());
  if (existing && !existing.catalogId) await db.update(t.exercises).set({ catalogId: entry.id }).where(eq(t.exercises.id, existing.id));
  refresh();
  return toOption({ ...row, catalogId: row.catalogId ?? entry.id });
}

/** Points one of the user's exercises at a library entry, keeping its history. `rename` takes the library's name too. */
export async function linkCatalog(exerciseId: string, catalogId: string | null, rename = false) {
  const user = await requireUser();
  const ex = await ownExercise(user.id, exerciseId);
  if (!catalogId) {
    await db.update(t.exercises).set({ catalogId: null }).where(eq(t.exercises.id, ex.id));
  } else {
    const entry = libraryEntry(catalogId);
    await db
      .update(t.exercises)
      .set({ catalogId: entry.id, ...(rename ? { name: entry.name, muscle: entry.muscle as (typeof MUSCLE_GROUPS)[number], equipment: entry.equipment ?? ex.equipment } : {}) })
      .where(eq(t.exercises.id, ex.id));
  }
  refresh();
}

export async function updateExercise(fd: FormData) {
  const user = await requireUser();
  const ex = await ownExercise(user.id, reqStr(fd, "id"));
  await db.update(t.exercises).set(readExercise(fd)).where(eq(t.exercises.id, ex.id));
  refresh();
}
