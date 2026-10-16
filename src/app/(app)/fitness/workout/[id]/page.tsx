import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getExerciseHistory, ownWorkout } from "@/lib/fitness";
import type { ExerciseOption } from "@/lib/fitness-math";
import { Logger, type Prescription } from "./logger";

export default function WorkoutPage(props: PageProps<"/fitness/workout/[id]">) {
  return (
    <Suspense fallback={<LoggerSkeleton />}>
      <WorkoutContent params={props.params} />
    </Suspense>
  );
}

function LoggerSkeleton() {
  return (
    <div className="pt-16">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-6 h-56 rounded-[22px]" />
      <Skeleton className="mt-4 h-56 rounded-[22px]" />
    </div>
  );
}

async function WorkoutContent({ params }: { params: PageProps<"/fitness/workout/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const log = await ownWorkout(user.id, id).catch(() => null);
  if (!log) notFound();

  const [sets, prescriptionRows, exercises, routine] = await Promise.all([
    db
      .select()
      .from(t.setLogs)
      .where(eq(t.setLogs.workoutLogId, log.id))
      .orderBy(asc(t.setLogs.exerciseOrder), asc(t.setLogs.setIndex)),
    log.templateId
      ? db.select().from(t.templateExercises).where(eq(t.templateExercises.templateId, log.templateId))
      : Promise.resolve([]),
    db
      .select({
        id: t.exercises.id,
        name: t.exercises.name,
        muscle: t.exercises.muscle,
        equipment: t.exercises.equipment,
        type: t.exercises.type,
        weightBasis: t.exercises.weightBasis,
        unilateral: t.exercises.unilateral,
      })
      .from(t.exercises)
      .where(eq(t.exercises.userId, user.id))
      .orderBy(asc(t.exercises.name)),
    log.templateId
      ? db
          .select({ color: t.workoutTemplates.color })
          .from(t.workoutTemplates)
          .where(eq(t.workoutTemplates.id, log.templateId))
          .get()
      : Promise.resolve(undefined),
  ]);

  const exIds = [...new Set(sets.map((s) => s.exerciseId))];
  const history = await getExerciseHistory(user.id, exIds, log.id);

  const prescriptions: Record<string, Prescription> = {};
  for (const p of prescriptionRows) {
    prescriptions[p.exerciseId] ??= {
      sets: p.sets,
      repsMin: p.repsMin,
      repsMax: p.repsMax,
      reps: p.reps,
      provisional: p.provisional,
      notes: p.notes,
      restSec: p.restSec,
    };
  }

  return (
    <Logger
      log={{
        id: log.id,
        name: log.name,
        date: log.date,
        status: log.status,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        feeling: log.feeling,
        notes: log.notes,
      }}
      color={routine?.color ?? "coral"}
      today={user.today}
      initialSets={sets}
      prescriptions={prescriptions}
      exercises={exercises as ExerciseOption[]}
      history={Object.fromEntries(history)}
    />
  );
}
