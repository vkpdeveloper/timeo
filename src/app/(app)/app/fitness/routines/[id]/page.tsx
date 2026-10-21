import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { WEEKDAY_NAMES } from "@/lib/dates";
import type { ExerciseOption } from "@/lib/fitness-math";
import { RoutineEditor } from "./editor";

export default function RoutinePage(props: PageProps<"/app/fitness/routines/[id]">) {
  return (
    <>
      <SubHeader back="/app/fitness/routines" backLabel="Routines" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-64 rounded-[22px]" />
          </div>
        }
      >
        <Routine params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Routine({
  params,
  searchParams,
}: {
  params: PageProps<"/app/fitness/routines/[id]">["params"];
  searchParams: PageProps<"/app/fitness/routines/[id]">["searchParams"];
}) {
  const user = await requireUser();
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const [routine, items, exercises, days] = await Promise.all([
    db
      .select()
      .from(t.workoutTemplates)
      .where(and(eq(t.workoutTemplates.id, id), eq(t.workoutTemplates.userId, user.id)))
      .get(),
    db
      .select({
        id: t.templateExercises.id,
        exerciseId: t.templateExercises.exerciseId,
        name: t.exercises.name,
        weightBasis: t.exercises.weightBasis,
        sets: t.templateExercises.sets,
        repsMin: t.templateExercises.repsMin,
        repsMax: t.templateExercises.repsMax,
        reps: t.templateExercises.reps,
        restSec: t.templateExercises.restSec,
        notes: t.templateExercises.notes,
        provisional: t.templateExercises.provisional,
      })
      .from(t.templateExercises)
      .innerJoin(t.exercises, eq(t.exercises.id, t.templateExercises.exerciseId))
      .innerJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.templateExercises.templateId))
      .where(and(eq(t.templateExercises.templateId, id), eq(t.workoutTemplates.userId, user.id)))
      .orderBy(asc(t.templateExercises.sortOrder), asc(t.templateExercises.id)),
    db
      .select({
        id: t.exercises.id,
        name: t.exercises.name,
        muscle: t.exercises.muscle,
        equipment: t.exercises.equipment,
        type: t.exercises.type,
        weightBasis: t.exercises.weightBasis,
        unilateral: t.exercises.unilateral,
        catalogId: t.exercises.catalogId,
      })
      .from(t.exercises)
      .where(eq(t.exercises.userId, user.id))
      .orderBy(asc(t.exercises.name)),
    db
      .select({ weekday: t.gymSchedule.weekday })
      .from(t.gymSchedule)
      .where(and(eq(t.gymSchedule.userId, user.id), eq(t.gymSchedule.templateId, id))),
  ]);
  if (!routine) notFound();

  return (
    <RoutineEditor
      routine={routine}
      items={items}
      exercises={exercises as ExerciseOption[]}
      days={days.map((d) => WEEKDAY_NAMES[d.weekday])}
      isNew={isNew}
    />
  );
}
