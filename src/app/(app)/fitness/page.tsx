import {
  CalendarRange,
  Clock,
  Dumbbell,
  History,
  LayoutGrid,
  ListChecks,
  Play,
  Scale,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import {
  AskTimi,
  Card,
  PageHeader,
  Row,
  Section,
  SectionLink,
  Skeleton,
  Stat,
  StatStrip,
} from "@/components/ui/primitives";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { colorVar, tint } from "@/lib/colors";
import { addDays, formatLongDate, formatMin, formatWeekdayShort, WEEKDAY_SHORT, weekday } from "@/lib/dates";
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
import { fmtKg, rollingAverage } from "@/lib/fitness-math";
import { startWorkout } from "./actions";
import { MacroRings, StatusChip, WeekStrip } from "./_components/bits";
import { Sparkline } from "./_components/charts";
import { MarkDayButtons, StartOtherButton, UndoMarkButton, type RoutineOption } from "./_components/day-actions";
import { WaterCard } from "./_components/water";
import { WorkoutClockText } from "./_components/workout-clock";

export default function FitnessPage() {
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
        <Skeleton className="mb-2 h-3 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="mt-4 h-52 rounded-[20px]" />
      <Skeleton className="mt-6 h-28 rounded-[20px]" />
      <Skeleton className="mt-6 h-40 rounded-[20px]" />
    </div>
  );
}

/** The next training day after `date` in the weekly split (looks up to a week ahead). */
function nextSession(schedule: ScheduleDay[], date: string) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    const s = schedule[weekday(d)];
    if (s?.routine) return { date: d, inDays: i, routine: s.routine, startMin: s.startMin };
  }
  return null;
}

async function Hub() {
  const user = await requireUser();
  const routinesP = getRoutines(user.id);
  const scheduleP = getSchedule(user.id, routinesP);
  const [routines, schedule, week, { streak, target }, nutrition, weights, latest] = await Promise.all([
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
  const delta = latest?.weightKg != null && first != null && weights.length > 1 ? Math.round((latest.weightKg - first) * 10) / 10 : null;
  const kcalLeft = nutrition.target ? nutrition.target.calories - nutrition.totals.calories : null;
  const left = week.planned - week.done;
  const trainingDays = schedule.filter((d) => d.routine).length;
  const plannedToday = !today.log && !!today.scheduled.routine;

  return (
    <div>
      <PageHeader
        eyebrow={formatLongDate(user.today)}
        title="Fitness"
        action={plannedToday ? <AskTimi prompt={GUIDE.logWorkout} label="Log as planned" /> : undefined}
      />

      <StatStrip>
        <Stat
          value={`${week.done}/${week.planned}`}
          label={left > 0 ? "sessions this week" : "week done"}
          tone={week.planned > 0 && left <= 0 ? "ok" : "default"}
          href="/fitness/history"
        />
        <Stat value={streak} unit={streak === 1 ? "wk" : "wks"} label={target > 1 ? `week streak, ${target}+ a week` : "week streak"} />
        <Stat
          value={latest?.weightKg != null ? fmtKg(latest.weightKg) : "—"}
          unit={latest?.weightKg != null ? "kg" : undefined}
          label={
            delta == null ? "body weight" : delta === 0 ? "flat in 30 days" : `${delta > 0 ? "+" : "−"}${fmtKg(Math.abs(delta))} in 30 days`
          }
          href="/fitness/body"
        />
        <Stat
          value={kcalLeft == null ? "—" : Math.abs(kcalLeft).toLocaleString("en-US")}
          label={kcalLeft == null ? "no kcal target" : kcalLeft >= 0 ? "kcal left today" : "kcal over today"}
          tone={kcalLeft != null && kcalLeft < 0 ? "warn" : "default"}
          href="/fitness/nutrition"
        />
      </StatStrip>

      <Reveal delay={60} className="mt-5">
        <TodayCard day={today} routines={options} next={nextSession(schedule, user.today)} />
      </Reveal>

      <Section
        title="This week"
        count={week.planned ? `${week.done} of ${week.planned} done` : undefined}
        action={<SectionLink href="/fitness/history">History</SectionLink>}
      >
        <Card className="overflow-hidden">
          <div className="px-2 py-2">
            <WeekStrip days={week.days} href={(d) => (d.log ? `/fitness/history/${d.log.id}` : null)} />
          </div>
          {notes.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
              {notes.map((d) => (
                <p key={d.date} className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
                  <span className="w-8 shrink-0 font-semibold text-ink-3">{formatWeekdayShort(d.date)}</span>
                  <span className="min-w-0">
                    {d.status === "skipped"
                      ? `Skipped ${d.plannedName}: ${d.log?.skipReason}`
                      : `${d.log?.name} instead of ${d.plannedName}`}
                  </span>
                </p>
              ))}
            </div>
          )}
        </Card>
      </Section>

      <Section
        title="Nutrition"
        count={nutrition.target?.planName}
        action={<SectionLink href="/fitness/nutrition">Meals</SectionLink>}
        card
      >
        <Link href="/fitness/nutrition" className="tap-row block px-3 pt-4 pb-3.5">
          <MacroRings totals={nutrition.totals} target={nutrition.target} />
          {!nutrition.target && (
            <p className="mt-3 px-1 text-center text-[13px] text-ink-3">No active plan. Pick one to see targets.</p>
          )}
        </Link>
        <WaterCard ml={nutrition.waterMl} targetMl={nutrition.waterTargetMl} day={user.today} />
      </Section>

      <Section title="Training" card stagger>
        <Row
          href="/fitness/routines"
          icon={<Dumbbell />}
          iconColor="coral"
          title="Routines"
          value={routines.length || undefined}
        />
        <Row
          href="/fitness/schedule"
          icon={<CalendarRange />}
          iconColor="indigo"
          title="Weekly split"
          value={`${trainingDays} ${trainingDays === 1 ? "day" : "days"}`}
        />
        <Row href="/fitness/programs" icon={<LayoutGrid />} iconColor="teal" title="Programs" subtitle="Load a whole split in one tap" />
        <Row href="/fitness/history" icon={<History />} iconColor="sage" title="History" />
        <Row href="/fitness/exercises" icon={<ListChecks />} iconColor="violet" title="Exercises" />
        <Row href="/fitness/body" icon={<Scale />} iconColor="rose" title="Body">
          <Sparkline
            values={rollingAverage(weights.map((w) => ({ date: w.date, value: w.weightKg })))}
            width={88}
            height={28}
            color="var(--c-rose)"
            className="ml-auto"
          />
        </Row>
        <Row href="/fitness/import" icon={<Upload />} iconColor="slate" title="Import" subtitle="Past training from a sheet or app" />
      </Section>
    </div>
  );
}

function Facts({ routine }: { routine: RoutineSummary }) {
  return (
    <div className="tnum mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5 text-ink-3" /> ~{routine.estimatedMin} min
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dumbbell className="size-3.5 text-ink-3" /> {routine.exerciseCount} exercises
      </span>
      <span className="text-ink-3">{routine.setCount} sets</span>
    </div>
  );
}

function TodayCard({
  day,
  routines,
  next,
}: {
  day: TrainingDay;
  routines: RoutineOption[];
  next: ReturnType<typeof nextSession>;
}) {
  const s = day.scheduled;
  const r = s.routine;
  const log = day.log;
  const color = day.color;
  const time = s.startMin != null ? formatMin(s.startMin) : null;

  // A session exists for today
  if (log) {
    const name = log.status === "skipped" ? day.plannedName : log.name;
    return (
      <Card className="overflow-hidden" style={tint(color)}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow" style={{ color: log.status === "skipped" ? undefined : colorVar(color) }}>
              Today
            </span>
            <StatusChip status={log.status} />
          </div>
          <h2 className="display mt-1 text-[30px] text-ink">{name}</h2>
          {day.swapped && <p className="mt-0.5 text-[13.5px] text-ink-3">Planned: {day.plannedName}</p>}
          {log.status === "skipped" && log.skipReason && <p className="mt-1 text-[14px] text-ink-2">{log.skipReason}</p>}
          {log.status === "in_progress" && (
            <WorkoutClockText clock={log} className="tnum-live mt-0.5 block text-[15px] font-medium text-ink-2" />
          )}
          <div className="mt-4 flex items-center gap-2">
            {log.status === "in_progress" ? (
              <ButtonLink href={`/fitness/workout/${log.id}`} variant="accent" size="lg">
                <Play className="size-4 fill-current" /> Back to workout
              </ButtonLink>
            ) : log.status === "completed" ? (
              <ButtonLink href={`/fitness/history/${log.id}`} variant="secondary" size="lg">
                View session
              </ButtonLink>
            ) : (
              <>
                {log.status === "unlogged" && log.templateId ? (
                  <form action={startWorkout.bind(null, log.templateId, day.date)} className="flex-1">
                    <SubmitButton variant="secondary" size="lg">Add sets</SubmitButton>
                  </form>
                ) : r ? (
                  <form action={startWorkout.bind(null, r.id, day.date)} className="flex-1">
                    <SubmitButton variant="secondary" size="lg">Train anyway</SubmitButton>
                  </form>
                ) : null}
                <UndoMarkButton logId={log.id} />
              </>
            )}
          </div>
        </div>
        {log.status === "completed" && next && <NextLine next={next} />}
      </Card>
    );
  }

  // Rest day
  if (!r) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Today · {WEEKDAY_SHORT[weekday(day.date)]}</span>
            <StatusChip status="rest" />
          </div>
          <h2 className="display mt-1 text-[30px] text-ink">{s.label ?? "Rest day"}</h2>
          {s.notes && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.notes}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line py-1 pr-2 pl-4">
          <span className="min-w-0 truncate text-[13.5px] text-ink-3">
            {next ? (
              <>
                Next <b className="font-semibold text-ink">{next.routine.name}</b> {whenLabel(next)}
              </>
            ) : (
              "No training days in your split"
            )}
          </span>
          <StartOtherButton routines={routines} date={day.date} label="Train anyway" />
        </div>
      </Card>
    );
  }

  // A planned session, not started
  return (
    <Card className="overflow-hidden" style={tint(color)}>
      <div className="relative p-4">
        <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-full" style={{ background: colorVar(color) }} />
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow" style={{ color: colorVar(color) }}>
            Today{time ? ` · ${time}` : ""}
          </span>
          <Link
            href={`/fitness/routines/${r.id}`}
            className="tap -my-2 -mr-1 inline-flex h-10 items-center px-1 text-[13px] font-medium text-ink-3"
          >
            View routine
          </Link>
        </div>
        <h2 className="display mt-0.5 text-[32px] text-ink">{r.name}</h2>
        {r.focus && <p className="text-[14px] text-ink-2">{r.focus}</p>}
        <Facts routine={r} />
        {s.notes && <p className="mt-2 text-[13.5px] text-ink-3">{s.notes}</p>}
        <form action={startWorkout.bind(null, r.id, day.date)} className="mt-4">
          <SubmitButton variant="accent" size="lg" className="h-[52px] text-[16.5px]">
            <Play className="size-4 fill-current" /> Start workout
          </SubmitButton>
        </form>
      </div>
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <MarkDayButtons date={day.date} routines={routines} scheduledId={r.id} className="flex-1" />
        <StartOtherButton routines={routines} date={day.date} label="Other" />
      </div>
    </Card>
  );
}

function whenLabel(next: NonNullable<ReturnType<typeof nextSession>>) {
  const when = next.inDays === 1 ? "tomorrow" : WEEKDAY_SHORT[weekday(next.date)];
  return next.startMin != null ? `${when}, ${formatMin(next.startMin)}` : when;
}

function NextLine({ next }: { next: NonNullable<ReturnType<typeof nextSession>> }) {
  return (
    <div className="border-t border-line px-4 py-3 text-[13.5px] text-ink-3">
      Next <b className="font-semibold text-ink">{next.routine.name}</b> {whenLabel(next)} · ~{next.routine.estimatedMin} min
    </div>
  );
}
