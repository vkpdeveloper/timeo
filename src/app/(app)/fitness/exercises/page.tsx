import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { MUSCLES, muscleLabel } from "@/lib/fitness-math";

export default function ExercisesPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" title="Exercises" />
      <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-[22px]" />}>
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
      sessions: sql<number>`(select count(distinct s.workout_log_id) from ${t.setLogs} s where s.exercise_id = "exercises"."id" and s.done = 1)`,
    })
    .from(t.exercises)
    .where(eq(t.exercises.userId, user.id))
    .orderBy(asc(t.exercises.name));

  const groups = MUSCLES.map((m) => ({ ...m, items: rows.filter((r) => r.muscle === m.value) })).filter((g) => g.items.length);

  return (
    <div className="fade-up pb-8">
      <h1 className="display px-1 pt-5 pb-4 text-[38px] text-ink">Exercises</h1>
      {groups.map((g) => (
        <section key={g.value} className="mt-6 first:mt-0">
          <h2 className="eyebrow mb-2 px-1">{g.label}</h2>
          <div className="card overflow-hidden">
            {g.items.map((e) => (
              <Link
                key={e.id}
                href={`/fitness/exercises/${e.id}`}
                className="tap flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 active:bg-sunken"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{e.name}</div>
                  <div className="truncate text-[12.5px] text-ink-3">
                    {[e.equipment ?? muscleLabel(e.muscle), e.weightBasis === "per_hand" ? "per hand" : e.weightBasis === "per_arm" ? "per arm" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {Number(e.sessions) > 0 && (
                  <span className="tnum shrink-0 text-[12.5px] text-ink-3">
                    {Number(e.sessions)} {Number(e.sessions) === 1 ? "session" : "sessions"}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
