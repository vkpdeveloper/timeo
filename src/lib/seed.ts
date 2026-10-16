import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import {
  EXERCISE_LIBRARY,
  STARTER_ROUTINES,
  STARTER_SCHEDULE,
  STARTER_TRAINING_NOTES,
  repsLabel,
} from "@/lib/fitness-library";

/** Gives a new account an exercise library, the starter routines and a weekly split. */
export async function seedNewUser(userId: string) {
  const exerciseRows = EXERCISE_LIBRARY.map((e) => ({
    id: crypto.randomUUID(),
    userId,
    name: e.name,
    muscle: e.muscle,
    equipment: e.equipment,
    type: e.type ?? ("weight" as const),
    weightBasis: e.weightBasis ?? ("total" as const),
    unilateral: e.unilateral ?? false,
    cues: e.cues ?? null,
  }));
  const byName = new Map(exerciseRows.map((e) => [e.name, e.id]));

  const routineRows = STARTER_ROUTINES.map((r) => ({
    id: crypto.randomUUID(),
    userId,
    name: r.name,
    focus: r.focus,
    color: r.color,
    estimatedMin: r.estimatedMin,
    notes: r.notes ?? null,
  }));
  const routineByName = new Map(routineRows.map((r) => [r.name, r.id]));

  const templateExerciseRows = STARTER_ROUTINES.flatMap((r, ri) =>
    r.exercises.map((e, i) => ({
      templateId: routineRows[ri].id,
      exerciseId: byName.get(e.name)!,
      sortOrder: i,
      sets: e.sets,
      repsMin: e.reps[0],
      repsMax: e.reps[1],
      reps: repsLabel(e.reps[0], e.reps[1]),
      restSec: e.restSec ?? 90,
      provisional: e.provisional ?? false,
      notes: e.notes ?? null,
    })),
  );

  const scheduleRows = STARTER_SCHEDULE.map((d) => ({
    userId,
    weekday: d.weekday,
    templateId: d.routine ? routineByName.get(d.routine)! : null,
    label: d.label ?? null,
    notes: d.notes ?? null,
    startMin: d.startMin ?? null,
    durationMin: d.routine ? (STARTER_ROUTINES.find((r) => r.name === d.routine)?.estimatedMin ?? 60) : 30,
  }));

  await db.batch([
    db.insert(t.exercises).values(exerciseRows),
    db.insert(t.workoutTemplates).values(routineRows),
    db.insert(t.templateExercises).values(templateExerciseRows),
    db.insert(t.gymSchedule).values(scheduleRows),
    db.update(t.users).set({ trainingNotes: STARTER_TRAINING_NOTES }).where(eq(t.users.id, userId)),
  ]);
}
