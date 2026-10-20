import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { Exercise, GymScheduleDay, WorkoutTemplate } from "@/db/schema";
import { catalogIdFor } from "@/lib/exercise-catalog-server";
import { EXERCISE_LIBRARY, repsLabel } from "@/lib/fitness-library";
import type { ProgramData, ProgramRoutine } from "@/lib/gym-presets";

// Loading and snapshotting whole gym programs (routines + weekly split + notes).

type State = {
  exercises: Pick<Exercise, "id" | "name">[];
  templates: Pick<WorkoutTemplate, "id" | "name" | "archived">[];
};

type Stmt = Parameters<typeof db.batch>[0][number];

const key = (s: string) => s.trim().toLowerCase();

/** Statements that load `data` for a user, given what they already have. */
export function programStatements(userId: string, data: ProgramData, state: State): Stmt[] {
  const exStmts: Stmt[] = [];
  const stmts: Stmt[] = [];

  const exByName = new Map(state.exercises.map((e) => [key(e.name), e.id]));
  const ensureExercise = (name: string) => {
    const found = exByName.get(key(name));
    if (found) return found;
    const lib = EXERCISE_LIBRARY.find((e) => key(e.name) === key(name));
    const id = crypto.randomUUID();
    exStmts.push(
      db.insert(t.exercises).values({
        id,
        userId,
        name: lib?.name ?? name.trim(),
        muscle: lib?.muscle ?? "full_body",
        equipment: lib?.equipment ?? null,
        type: lib?.type ?? "weight",
        weightBasis: lib?.weightBasis ?? "total",
        unilateral: lib?.unilateral ?? false,
        cues: lib?.cues ?? null,
        catalogId: catalogIdFor(lib?.name ?? name),
      }),
    );
    exByName.set(key(name), id);
    return id;
  };

  const tplByName = new Map(state.templates.map((r) => [key(r.name), r]));
  const routineIds = new Map<string, string>();
  for (const r of data.routines) {
    if (routineIds.has(key(r.name))) continue;
    const existing = tplByName.get(key(r.name));
    const values = {
      name: r.name,
      focus: r.focus || null,
      color: r.color,
      estimatedMin: r.estimatedMin,
      notes: r.notes ?? null,
      archived: false,
    };
    let id: string;
    if (existing) {
      id = existing.id;
      stmts.push(db.update(t.workoutTemplates).set(values).where(eq(t.workoutTemplates.id, id)));
      stmts.push(db.delete(t.templateExercises).where(eq(t.templateExercises.templateId, id)));
    } else {
      id = crypto.randomUUID();
      stmts.push(db.insert(t.workoutTemplates).values({ id, userId, ...values }));
    }
    routineIds.set(key(r.name), id);
    const rows = r.exercises.map((e, i) => ({
      templateId: id,
      exerciseId: ensureExercise(e.name),
      sortOrder: i,
      sets: e.sets,
      repsMin: e.reps[0],
      repsMax: e.reps[1],
      reps: repsLabel(e.reps[0], e.reps[1]),
      restSec: e.restSec ?? 90,
      provisional: e.provisional ?? false,
      notes: e.notes ?? null,
    }));
    if (rows.length) stmts.push(db.insert(t.templateExercises).values(rows));
  }

  // Routines outside the program are archived, never deleted (logs reference them).
  const keep = new Set(routineIds.values());
  const archive = state.templates.filter((r) => !r.archived && !keep.has(r.id)).map((r) => r.id);
  if (archive.length) {
    stmts.push(db.update(t.workoutTemplates).set({ archived: true }).where(inArray(t.workoutTemplates.id, archive)));
  }

  for (let wd = 0; wd < 7; wd++) {
    const d = data.schedule.find((x) => x.weekday === wd);
    const templateId = d?.routine ? (routineIds.get(key(d.routine)) ?? null) : null;
    const routine = d?.routine ? data.routines.find((r) => key(r.name) === key(d.routine!)) : undefined;
    const values = {
      templateId,
      label: templateId ? null : (d?.label ?? "Rest"),
      notes: d?.notes ?? null,
      startMin: d?.startMin ?? null,
      durationMin: routine?.estimatedMin ?? 30,
    };
    stmts.push(
      db
        .insert(t.gymSchedule)
        .values({ userId, weekday: wd, ...values })
        .onConflictDoUpdate({ target: [t.gymSchedule.userId, t.gymSchedule.weekday], set: values }),
    );
  }

  stmts.push(db.update(t.users).set({ trainingNotes: data.trainingNotes ?? null }).where(eq(t.users.id, userId)));
  return [...exStmts, ...stmts];
}

/**
 * Loads a program for a user in one batch: matches exercises by name (creating
 * missing ones), reuses routines with the same name, archives the rest,
 * rewrites all 7 schedule days and the program notes. Logs are untouched.
 */
export async function applyProgram(userId: string, data: ProgramData) {
  const [exercises, templates] = await Promise.all([
    db.select({ id: t.exercises.id, name: t.exercises.name }).from(t.exercises).where(eq(t.exercises.userId, userId)),
    db
      .select({ id: t.workoutTemplates.id, name: t.workoutTemplates.name, archived: t.workoutTemplates.archived })
      .from(t.workoutTemplates)
      .where(eq(t.workoutTemplates.userId, userId))
      .orderBy(asc(t.workoutTemplates.archived), asc(t.workoutTemplates.createdAt)),
  ]);
  // prefer an active routine when an archived one has the same name
  const seen = new Set<string>();
  const unique = templates.filter((r) => (seen.has(key(r.name)) ? false : (seen.add(key(r.name)), true)));
  const extra = templates.filter((r) => !unique.includes(r));
  const stmts = programStatements(userId, data, { exercises, templates: unique });
  const dupes = extra.filter((r) => !r.archived).map((r) => r.id);
  if (dupes.length) stmts.push(db.update(t.workoutTemplates).set({ archived: true }).where(inArray(t.workoutTemplates.id, dupes)));
  await db.batch(stmts as [Stmt, ...Stmt[]]);
}

/** The user's current routines, split and notes as a program. */
export async function snapshotProgram(userId: string): Promise<ProgramData> {
  const [templates, items, schedule, user] = await Promise.all([
    db
      .select()
      .from(t.workoutTemplates)
      .where(and(eq(t.workoutTemplates.userId, userId), eq(t.workoutTemplates.archived, false)))
      .orderBy(asc(t.workoutTemplates.createdAt)),
    db
      .select({ te: t.templateExercises, name: t.exercises.name })
      .from(t.templateExercises)
      .innerJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.templateExercises.templateId))
      .innerJoin(t.exercises, eq(t.exercises.id, t.templateExercises.exerciseId))
      .where(and(eq(t.workoutTemplates.userId, userId), eq(t.workoutTemplates.archived, false)))
      .orderBy(asc(t.templateExercises.sortOrder)),
    db.select().from(t.gymSchedule).where(eq(t.gymSchedule.userId, userId)),
    db.select({ notes: t.users.trainingNotes }).from(t.users).where(eq(t.users.id, userId)).get(),
  ]);
  const routines: ProgramRoutine[] = templates.map((r) => ({
    name: r.name,
    focus: r.focus ?? "",
    color: r.color,
    estimatedMin: r.estimatedMin,
    notes: r.notes ?? undefined,
    exercises: items
      .filter((i) => i.te.templateId === r.id)
      .map(({ te, name }) => ({
        name,
        sets: te.sets,
        reps: [te.repsMin ?? te.repsMax ?? 8, te.repsMax ?? te.repsMin ?? 12] as [number, number],
        restSec: te.restSec,
        provisional: te.provisional || undefined,
        notes: te.notes ?? undefined,
      })),
  }));
  const nameOf = new Map(templates.map((r) => [r.id, r.name]));
  return {
    routines,
    schedule: schedule
      .sort((a: GymScheduleDay, b: GymScheduleDay) => a.weekday - b.weekday)
      .map((d) => ({
        weekday: d.weekday,
        routine: d.templateId ? nameOf.get(d.templateId) : undefined,
        label: d.templateId && nameOf.has(d.templateId) ? undefined : (d.label ?? "Rest"),
        notes: d.notes ?? undefined,
        startMin: d.startMin ?? undefined,
      })),
    trainingNotes: user?.notes ?? undefined,
  };
}

/** True when the user's split runs exactly this program's routines on the same days. */
export function sameSplit(current: ProgramData, program: ProgramData) {
  for (let wd = 0; wd < 7; wd++) {
    const a = current.schedule.find((d) => d.weekday === wd)?.routine;
    const b = program.schedule.find((d) => d.weekday === wd)?.routine;
    if (key(a ?? "") !== key(b ?? "")) return false;
  }
  return program.routines.some(Boolean);
}
