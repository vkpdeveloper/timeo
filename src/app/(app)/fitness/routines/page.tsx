import { Dumbbell, Play, Plus } from "lucide-react";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Row, RowIcon, Section, Skeleton, SubHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { getRoutines, getSchedule } from "@/lib/fitness";
import { startWorkout } from "../actions";
import { createRoutine } from "./actions";

export default function RoutinesPage() {
  return (
    <>
      <SubHeader
        back="/fitness"
        backLabel="Fitness"
        action={
          <form action={createRoutine}>
            <SubmitButton variant="ghost" size="icon" className="-mr-2 text-accent" aria-label="New routine">
              <Plus className="size-5" />
            </SubmitButton>
          </form>
        }
      />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-72 rounded-[20px]" />
          </div>
        }
      >
        <RoutineList />
      </Suspense>
    </>
  );
}

async function RoutineList() {
  const user = await requireUser();
  const routinesP = getRoutines(user.id);
  const [list, schedule] = await Promise.all([routinesP, getSchedule(user.id, routinesP)]);
  const firstDay = (id: string) => schedule.find((d) => d.templateId === id)?.weekday ?? 99;
  const routines = [...list].sort((a, b) => firstDay(a.id) - firstDay(b.id));

  if (!routines.length) {
    return (
      <>
        <PageHeader title="Routines" />
        <EmptyState
          icon={<Dumbbell />}
          title="No routines yet"
          body="A routine is a list of exercises with sets and rep ranges."
          action={
            <form action={createRoutine}>
              <SubmitButton variant="accent">New routine</SubmitButton>
            </form>
          }
        />
      </>
    );
  }

  const trainingDays = schedule.filter((d) => d.routine).length;

  return (
    <div>
      <PageHeader
        title="Routines"
        subtitle={`${routines.length} ${routines.length === 1 ? "routine" : "routines"} · ${trainingDays} training ${trainingDays === 1 ? "day" : "days"} a week`}
      />
      <Section card stagger>
        {routines.map((r) => {
          const days = schedule.filter((d) => d.templateId === r.id).map((d) => WEEKDAY_SHORT[d.weekday]);
          return (
            <div key={r.id} className="flex items-center">
              <Row
                href={`/fitness/routines/${r.id}`}
                className="min-w-0 flex-1 border-b-0! pr-2"
                icon={
                  <RowIcon color={r.color}>
                    <Dumbbell />
                  </RowIcon>
                }
                title={r.name}
                subtitle={[days.length ? days.join(" · ") : "Not scheduled", `${r.exerciseCount} exercises`, `~${r.estimatedMin} min`].join(" · ")}
                chevron={false}
              />
              <form action={startWorkout.bind(null, r.id, undefined)} className="shrink-0 pr-3">
                <SubmitButton variant="secondary" size="sm" aria-label={`Start ${r.name}`}>
                  <Play className="size-3 fill-current" /> Start
                </SubmitButton>
              </form>
            </div>
          );
        })}
      </Section>
      <form action={createRoutine} className="mt-3">
        <SubmitButton variant="outline" size="lg">
          <Plus className="size-4" /> New routine
        </SubmitButton>
      </form>
    </div>
  );
}
