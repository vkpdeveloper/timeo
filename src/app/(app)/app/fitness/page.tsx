import { CalendarRange, History, LayoutGrid, ListChecks, Play, Repeat, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { PageHeader, Row, Section, SectionLink, Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { colorVar, tint } from "@/lib/colors";
import { addDays, formatWeekdayShort, toTimeInput, toUTCDate, WEEKDAY_SHORT, weekday } from "@/lib/dates";
import {
  getLatestWeight,
  getNutritionDay,
  getRoutines,
  getSchedule,
  getTrainingWeek,
  getWeekStreak,
  getWeights,
  type RoutineSummary,
  type ScheduleDay,
  type TrainingDay,
} from "@/lib/fitness";
import { rollingAverage } from "@/lib/fitness-math";
import { startWorkout } from "./actions";
import { StatusChip, WeekStrip } from "./_components/bits";
import { FoodCard, WeightRow } from "./_components/body-hub";
import { MarkDayButtons, StartOtherButton, UndoMarkButton, type RoutineOption } from "./_components/day-actions";
import { WorkoutClockText } from "./_components/workout-clock";

export default function BodyPage() {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <Hub />
    </Suspense>
  );
}

function HubSkeleton() {
  return (
    <div>
      <div className="pt-5 pb-4 lg:pt-10 lg:pb-5">
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="mt-2 h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-48" />
      <Skeleton className="mt-3 h-4 w-56" />
      <Skeleton className="mt-6 h-12 rounded-[12px]" />
      <Skeleton className="mt-10 h-44 rounded-[16px]" />
      <Skeleton className="mt-3 h-16 rounded-[16px]" />
      <Skeleton className="mt-8 h-24 rounded-[16px]" />
    </div>
  );
}

const fmtDayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

/** The next training day after `date` in the weekly split (looks up to a week ahead). */
function nextSession(schedule: ScheduleDay[], date: string) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    const s = schedule[weekday(d)];
    if (s?.routine) return { date: d, inDays: i, routine: s.routine, startMin: s.startMin };
  }
  return null;
}
type Next = ReturnType<typeof nextSession>;

async function Hub() {
  const user = await requireUser();
  const routinesP = getRoutines(user.id);
  const scheduleP = getSchedule(user.id, routinesP);
  const [routines, schedule, week, { streak }, nutrition, weights, latest] = await Promise.all([
    routinesP,
    scheduleP,
    scheduleP.then((s) => getTrainingWeek(user.id, user.today, user.today, s)),
    scheduleP.then((s) => getWeekStreak(user.id, user.today, s.filter((d) => d.routine).length)),
    getNutritionDay(user.id, user.today),
    getWeights(user.id, addDays(user.today, -30)),
    getLatestWeight(user.id),
  ]);
  const today = week.days.find((d) => d.isToday)!;
  const options: RoutineOption[] = routines.map((r) => ({
    id: r.id,
    name: r.name,
    focus: r.focus,
    color: r.color,
    exerciseCount: r.exerciseCount,
  }));
  const notes = week.days.filter((d) => d.swapped || (d.status === "skipped" && d.log?.skipReason));
  const first = weights[0]?.weightKg;
  const delta =
    latest?.weightKg != null && first != null && weights.length > 1 ? Math.round((latest.weightKg - first) * 10) / 10 : null;
  const trainingDays = schedule.filter((d) => d.routine).length;

  return (
    <div className="page-enter">
      <PageHeader eyebrow={`${formatWeekdayShort(user.today)} ${fmtDayMonth.format(toUTCDate(user.today))}`} title="Body" />

      <TodaySession day={today} routines={options} next={nextSession(schedule, user.today)} />

      <Section
        title="Food"
        count={nutrition.target?.planName}
        action={<SectionLink href="/app/fitness/nutrition">Meals</SectionLink>}
        className="mt-10"
      >
        <FoodCard
          kcal={nutrition.totals.calories}
          kcalTarget={nutrition.target?.calories ?? null}
          protein={nutrition.totals.proteinG}
          proteinTarget={nutrition.target?.proteinG ?? null}
          waterMl={nutrition.waterMl}
          waterTargetMl={nutrition.waterTargetMl}
          day={user.today}
        />
        <WeightRow
          className="mt-3"
          kg={latest?.weightKg ?? null}
          delta={delta}
          trend={rollingAverage(weights.map((w) => ({ date: w.date, value: w.weightKg })))}
        />
      </Section>

      <Section
        title="This week"
        count={
          week.planned
            ? `${week.done} of ${week.planned}${streak > 1 ? ` · ${streak}-week streak` : ""}`
            : undefined
        }
        action={<SectionLink href="/app/fitness/schedule">Split</SectionLink>}
        className="mt-8"
      >
        <div className="card overflow-hidden">
          <div className="p-1.5">
            <WeekStrip days={week.days} href={(d) => (d.log ? `/app/fitness/history/${d.log.id}` : null)} />
          </div>
          {notes.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
              {notes.map((d) => (
                <p key={d.date} className="flex gap-2 text-[13px] leading-snug text-ink-2">
                  <span className="w-8 shrink-0 font-medium text-ink-3">{formatWeekdayShort(d.date)}</span>
                  <span className="min-w-0">
                    {d.status === "skipped" ? `Skipped ${d.plannedName}: ${d.log?.skipReason}` : `${d.log?.name} instead of ${d.plannedName}`}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Training" card stagger className="mt-8">
        <Row href="/app/fitness/routines" icon={<Repeat />} title="Routines" value={routines.length || undefined} />
        <Row
          href="/app/fitness/schedule"
          icon={<CalendarRange />}
          title="Weekly split"
          value={`${trainingDays} ${trainingDays === 1 ? "day" : "days"}`}
        />
        <Row href="/app/fitness/history" icon={<History />} title="History" />
        <Row href="/app/fitness/exercises" icon={<ListChecks />} title="Exercises" />
        <Row href="/app/fitness/programs" icon={<LayoutGrid />} title="Programs" subtitle="Load a whole split in one tap" />
        <Row href="/app/fitness/import" icon={<Upload />} title="Import" subtitle="Past training from a sheet or app" />
      </Section>
    </div>
  );
}

/* ── Today's session: the hero. No card, one button. ── */

function Meta({ routine }: { routine: RoutineSummary }) {
  const parts = [
    `${routine.exerciseCount} ${routine.exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${routine.setCount} sets`,
    `~${routine.estimatedMin} min`,
  ];
  return <p className="tnum mt-1.5 text-[15px] text-ink-2">{parts.join(" · ")}</p>;
}

function Eyebrow({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
      {color && <span className="size-2 rounded-full" style={{ background: colorVar(color) }} />}
      {children}
    </div>
  );
}

function whenLabel(next: NonNullable<Next>) {
  const when = next.inDays === 1 ? "Tomorrow" : WEEKDAY_SHORT[weekday(next.date)];
  return (
    <>
      {when}
      {next.startMin != null && (
        <>
          {" "}
          <span className="mono">{toTimeInput(next.startMin)}</span>
        </>
      )}
    </>
  );
}

function NextLine({ next }: { next: Next }) {
  return (
    <p className="mt-5 text-[14px] text-ink-3">
      {next ? (
        <>
          Next: <span className="font-medium text-ink-2">{next.routine.name}</span> · {whenLabel(next)}
        </>
      ) : (
        "No training days in your split yet."
      )}
    </p>
  );
}

function TodaySession({ day, routines, next }: { day: TrainingDay; routines: RoutineOption[]; next: Next }) {
  const s = day.scheduled;
  const r = s.routine;
  const log = day.log;

  // Something is logged for today
  if (log) {
    const name = log.status === "skipped" ? day.plannedName : log.name;
    return (
      <section className="rise pt-2" style={tint(day.color)}>
        <div className="flex items-center justify-between gap-3">
          <Eyebrow color={log.status === "skipped" ? undefined : day.color}>Today</Eyebrow>
          <StatusChip status={log.status} />
        </div>
        <h2 className="display mt-2 text-[32px] text-ink">{name}</h2>
        {day.swapped && <p className="mt-1 text-[14px] text-ink-3">Planned: {day.plannedName}</p>}
        {log.status === "skipped" && log.skipReason && <p className="mt-1 text-[15px] text-ink-2">{log.skipReason}</p>}
        {log.status === "in_progress" && (
          <p className="mt-1.5 text-[15px] text-ink-2">
            <WorkoutClockText clock={log} className="mono text-ink" /> trained
          </p>
        )}
        <div className="mt-6 flex items-center gap-2">
          {log.status === "in_progress" ? (
            <ButtonLink href={`/app/fitness/workout/${log.id}`} variant="accent" size="lg">
              <Play className="size-4 fill-current" /> Back to workout
            </ButtonLink>
          ) : log.status === "completed" ? (
            <ButtonLink href={`/app/fitness/history/${log.id}`} variant="outline" size="lg">
              View session
            </ButtonLink>
          ) : (
            <>
              {log.status === "unlogged" && log.templateId ? (
                <form action={startWorkout.bind(null, log.templateId, day.date)} className="flex-1">
                  <SubmitButton variant="outline" size="lg">Add sets</SubmitButton>
                </form>
              ) : r ? (
                <form action={startWorkout.bind(null, r.id, day.date)} className="flex-1">
                  <SubmitButton variant="outline" size="lg">Train anyway</SubmitButton>
                </form>
              ) : null}
              <UndoMarkButton logId={log.id} />
            </>
          )}
        </div>
        {log.status !== "in_progress" && <NextLine next={next} />}
      </section>
    );
  }

  // Rest day
  if (!r) {
    return (
      <section className="rise pt-2">
        <Eyebrow>Today</Eyebrow>
        <h2 className="display mt-2 text-[32px] text-ink">{s.label ?? "Rest day"}</h2>
        {s.notes && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{s.notes}</p>}
        <NextLine next={next} />
        <div className="mt-2 -ml-2">
          <StartOtherButton routines={routines} date={day.date} label="Train anyway" />
        </div>
      </section>
    );
  }

  // A planned session, not started
  return (
    <section className="rise pt-2" style={tint(day.color)}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow color={day.color}>
          Today
          {s.startMin != null && (
            <>
              {" · "}
              <span className="mono">{toTimeInput(s.startMin)}</span>
            </>
          )}
        </Eyebrow>
        <Link
          href={`/app/fitness/routines/${r.id}`}
          className="tap -my-3 -mr-1 inline-flex h-11 items-center px-1 text-[13px] font-medium text-ink-3 hover:text-ink"
        >
          View routine
        </Link>
      </div>
      <h2 className="display mt-2 text-[34px] text-ink">{r.name}</h2>
      {r.focus && <p className="mt-0.5 text-[15px] text-ink-2">{r.focus}</p>}
      <Meta routine={r} />
      {s.notes && <p className="mt-2 text-[14px] text-ink-3">{s.notes}</p>}
      <form action={startWorkout.bind(null, r.id, day.date)} className="mt-6">
        <SubmitButton variant="accent" size="lg" className="h-[52px] text-[16.5px]">
          <Play className="size-4 fill-current" /> Start workout
        </SubmitButton>
      </form>
      <div className="mt-2 -mx-2 flex items-center justify-between">
        <MarkDayButtons date={day.date} routines={routines} scheduledId={r.id} />
        <StartOtherButton routines={routines} date={day.date} label="Other" />
      </div>
    </section>
  );
}
