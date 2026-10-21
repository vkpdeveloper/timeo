import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getExerciseHistory, ownWorkout } from "@/lib/fitness";
import type { ExerciseOption } from "@/lib/fitness-math";
import { Logger, type Prescription } from "./logger";

export default function WorkoutPage(props: PageProps<"/app/fitness/workout/[id]">) {
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

async function WorkoutContent({ params }: { params: PageProps<"/app/fitness/workout/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const ownLog = and(eq(t.workoutLogs.id, id), eq(t.workoutLogs.userId, user.id));
  const [log, sets, prescriptionRows, exercises, routine] = await Promise.all([
    ownWorkout(user.id, id).catch(() => null),
    db
      .select({ s: t.setLogs })
      .from(t.setLogs)
      .innerJoin(t.workoutLogs, eq(t.workoutLogs.id, t.setLogs.workoutLogId))
      .where(ownLog)
      .orderBy(asc(t.setLogs.exerciseOrder), asc(t.setLogs.setIndex))
      .then((rows) => rows.map((r) => r.s)),
    db
      .select({ p: t.templateExercises })
      .from(t.templateExercises)
      .innerJoin(t.workoutLogs, eq(t.workoutLogs.templateId, t.templateExercises.templateId))
      .where(ownLog)
      .then((rows) => rows.map((r) => r.p)),
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
      .select({ color: t.workoutTemplates.color })
      .from(t.workoutTemplates)
      .innerJoin(t.workoutLogs, eq(t.workoutLogs.templateId, t.workoutTemplates.id))
      .where(ownLog)
      .get(),
  ]);
  if (!log) notFound();

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
        pausedAt: log.pausedAt,
        pausedMs: log.pausedMs,
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
