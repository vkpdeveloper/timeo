import { Dumbbell, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/button";
import { EmptyState, Skeleton, SubHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { colorVar } from "@/lib/colors";
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
        title="Routines"
        action={
          <form action={createRoutine}>
            <SubmitButton variant="ghost" size="sm" className="-mr-2 text-accent" aria-label="New routine">
              <Plus className="size-5" />
            </SubmitButton>
          </form>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3 pt-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-[22px]" />
            ))}
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
      <EmptyState
        className="mt-6"
        icon={<Dumbbell />}
        title="No routines yet"
        body="A routine is a list of exercises with sets and rep ranges."
        action={
          <form action={createRoutine}>
            <SubmitButton>New routine</SubmitButton>
          </form>
        }
      />
    );
  }

  return (
    <div className="fade-up flex flex-col gap-3 pt-5">
      <h1 className="display px-1 pb-2 text-[34px] text-ink">Routines</h1>
      {routines.map((r) => {
        const days = schedule.filter((d) => d.templateId === r.id).map((d) => WEEKDAY_SHORT[d.weekday]);
        return (
          <div key={r.id} className="card overflow-hidden">
            <Link href={`/fitness/routines/${r.id}`} className="tap flex gap-3.5 p-4 pb-3">
              <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: colorVar(r.color) }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="truncate text-[18px] font-semibold tracking-tight text-ink">{r.name}</h2>
                  {days.length > 0 && <span className="shrink-0 text-[12.5px] font-medium text-ink-3">{days.join(" · ")}</span>}
                </div>
                {r.focus && <p className="mt-0.5 truncate text-[13.5px] text-ink-2">{r.focus}</p>}
                <p className="tnum mt-1.5 text-[12.5px] text-ink-3">
                  {r.exerciseCount} exercises · {r.setCount} sets · ~{r.estimatedMin} min
                </p>
              </div>
            </Link>
            <form action={startWorkout.bind(null, r.id, undefined)} className="border-t border-line">
              <SubmitButton variant="ghost" className="h-11 w-full rounded-none text-[14px]" style={{ color: colorVar(r.color) }}>
                Start
              </SubmitButton>
            </form>
          </div>
        );
      })}
      <form action={createRoutine} className="mt-1">
        <SubmitButton variant="secondary" size="lg">
          <Plus className="size-4" /> New routine
        </SubmitButton>
      </form>
    </div>
  );
}
