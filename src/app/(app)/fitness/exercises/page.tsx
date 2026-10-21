import { asc, eq, sql } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, Row, RowIcon, Section, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { MUSCLES, muscleLabel } from "@/lib/fitness-math";
import { ExerciseThumb } from "../_components/exercise-photo";

export default function ExercisesPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-[52px] rounded-[20px]" />
            <Skeleton className="mt-6 h-96 rounded-[20px]" />
          </div>
        }
      >
        <ExerciseList />
      </Suspense>
    </>
  );
}

async function ExerciseList() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: t.exercises.id,
      name: t.exercises.name,
      muscle: t.exercises.muscle,
      equipment: t.exercises.equipment,
      weightBasis: t.exercises.weightBasis,
      catalogId: t.exercises.catalogId,
      sessions: sql<number>`(select count(distinct s.workout_log_id) from ${t.setLogs} s where s.exercise_id = "exercises"."id" and s.done = 1)`,
    })
    .from(t.exercises)
    .where(eq(t.exercises.userId, user.id))
    .orderBy(asc(t.exercises.name));

  const groups = MUSCLES.map((m) => ({ ...m, items: rows.filter((r) => r.muscle === m.value) })).filter((g) => g.items.length);

  const thumb = (catalogId: string | null) => (
    <RowIcon className="size-auto! bg-transparent!">
      <ExerciseThumb catalogId={catalogId} size={40} />
    </RowIcon>
  );

  return (
    <div>
      <PageHeader
        title="Exercises"
        subtitle={`${rows.length} ${rows.length === 1 ? "exercise" : "exercises"} across ${groups.length} muscle ${groups.length === 1 ? "group" : "groups"}`}
      />
      <Section card>
        <Row
          href="/fitness/exercises/library"
          icon={
            <RowIcon className="size-auto! bg-transparent!">
              <span className="flex -space-x-3">
                {["barbell-squat", "dumbbell-bicep-curl", "wide-grip-lat-pulldown"].map((id) => (
                  <ExerciseThumb key={id} catalogId={id} size={34} className="rounded-full ring-2 ring-surface" />
                ))}
              </span>
            </RowIcon>
          }
          title="Library"
          subtitle="870+ exercises with photos and steps"
        />
      </Section>
      {groups.map((g, gi) => (
        <Section key={g.value} title={g.label} count={g.items.length} card stagger={gi < 2}>
          {g.items.map((e) => (
            <Row
              key={e.id}
              href={`/fitness/exercises/${e.id}`}
              icon={thumb(e.catalogId)}
              title={e.name}
              subtitle={
                [e.equipment ?? muscleLabel(e.muscle), e.weightBasis === "per_hand" ? "per hand" : e.weightBasis === "per_arm" ? "per arm" : null]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              value={Number(e.sessions) > 0 ? `${Number(e.sessions)}×` : undefined}
            />
          ))}
        </Section>
      ))}
    </div>
  );
}
