import "server-only";
import { db, t } from "@/db";
import { EXERCISE_LIBRARY } from "@/lib/fitness-library";
import { programStatements } from "@/lib/gym-program";
import { GYM_PRESETS } from "@/lib/gym-presets";

/** Gives a new account the exercise library and the default program (Pull · Push · Legs). */
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
  const program = programStatements(userId, GYM_PRESETS[0], { exercises: exerciseRows, templates: [] });
  await db.batch([db.insert(t.exercises).values(exerciseRows), ...program]);
}
