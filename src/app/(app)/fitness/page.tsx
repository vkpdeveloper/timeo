import {
  Apple,
  CalendarRange,
  ChevronRight,
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
import { Card, PageHeader, Row, Section, SectionLink, Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { colorVar, tint } from "@/lib/colors";
import { addDays, formatLongDate, formatMin, formatWeekdayShort, weekday } from "@/lib/dates";
import {
  getLatestWeight,
  getNutritionDay,
  getRoutines,
  getSchedule,
  getTrainingWeek,
  getWeekStreak,
  getWeights,
  type TrainingDay,
} from "@/lib/fitness";
import { fmtKg, rollingAverage } from "@/lib/fitness-math";
import { startWorkout } from "./actions";
import { IconBadge, MacroSummary, Sparkline, StatTile, StatusChip, WeekStrip } from "./_components/bits";
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
      <div className="pt-6 pb-5 lg:pt-10">
        <Skeleton className="mb-2 h-3 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-64 rounded-[22px]" />
      <Skeleton className="mt-8 h-36 rounded-[22px]" />
      <Skeleton className="mt-8 h-40 rounded-[22px]" />
    </div>
  );
}

async function Hub() {
  const user = await requireUser();
  const routinesP = getRoutines(user.id);
  const scheduleP = getSchedule(user.id, routinesP);
  const [routines, week, { streak, target }, nutrition, weights, latest] = await Promise.all([
    routinesP,
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
  const delta = latest?.weightKg != null && first != null && weights.length > 1 ? latest.weightKg - first : null;

  return (
    <div className="fade-up">
      <PageHeader eyebrow={formatLongDate(user.today)} title="Fitness" />

      <TodayCard day={today} routines={options} />

      <Section title="This week" action={<SectionLink href="/fitness/history">History</SectionLink>}>
        <Card className="overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <WeekStrip days={week.days} href={(d) => (d.log ? `/fitness/history/${d.log.id}` : null)} />
          </div>
          {notes.length > 0 && (
            <div className="mx-4 mb-1 flex flex-col gap-1.5 border-t border-line pt-3 pb-2">
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
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            <StatTile label="Sessions" value={`${week.done}/${week.planned}`} />
            <StatTile label="Working sets" value={week.workingSets} />
            <StatTile
              label="Streak"
              value={`${streak} wk`}
              sub={`${target}+ a week`}
            />
          </div>
        </Card>
      </Section>

      <Section title="Nutrition today" action={<SectionLink href="/fitness/nutrition">Meals</SectionLink>}>
        <Link href="/fitness/nutrition" className="card tap block p-4">
          <MacroSummary totals={nutrition.totals} target={nutrition.target} compact />
          {!nutrition.target && (
            <p className="mt-3 text-[13px] text-ink-3">No active plan. Pick one to see targets.</p>
          )}
        </Link>
        <div className="mt-3">
          <WaterCard ml={nutrition.waterMl} targetMl={nutrition.waterTargetMl} day={user.today} />
        </div>
      </Section>

      <Section title="Body" action={<SectionLink href="/fitness/body">Trend</SectionLink>}>
        <Link href="/fitness/body" className="card tap flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-ink-3">Weight</div>
            {latest?.weightKg != null ? (
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="display tnum text-[34px] text-ink">{fmtKg(latest.weightKg)}</span>
                <span className="text-[13px] font-medium text-ink-3">kg</span>
              </div>
            ) : (
              <div className="mt-1 text-[15px] font-medium text-ink-2">No weigh-ins yet</div>
            )}
            {delta != null && (
              <div className="tnum text-[12.5px] text-ink-3">
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${fmtKg(Math.abs(Math.round(delta * 10) / 10))} kg`} in 30 days
              </div>
            )}
          </div>
          <Sparkline values={rollingAverage(weights.map((w) => ({ date: w.date, value: w.weightKg })))} width={128} height={44} />
          <ChevronRight className="size-4 shrink-0 text-ink-3" />
        </Link>
      </Section>

      <Section title="Training">
        <Card>
          <Row href="/fitness/programs">
            <IconBadge color="var(--c-teal)"><LayoutGrid /></IconBadge>
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-ink">Programs</span>
              <span className="block text-[12.5px] text-ink-3">Load a whole split in one tap</span>
            </span>
          </Row>
          <Row href="/fitness/routines">
            <IconBadge color="var(--c-coral)"><Dumbbell /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Routines</span>
            <span className="text-[13px] text-ink-3">{routines.length}</span>
          </Row>
          <Row href="/fitness/schedule">
            <IconBadge color="var(--c-indigo)"><CalendarRange /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Weekly split</span>
          </Row>
          <Row href="/fitness/history">
            <IconBadge color="var(--c-sage)"><History /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">History</span>
          </Row>
          <Row href="/fitness/exercises">
            <IconBadge color="var(--c-violet)"><ListChecks /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Exercises</span>
          </Row>
          <Row href="/fitness/nutrition">
            <IconBadge color="var(--c-amber)"><Apple /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Nutrition</span>
            {nutrition.target && <span className="truncate text-[13px] text-ink-3">{nutrition.target.planName}</span>}
          </Row>
          <Row href="/fitness/body">
            <IconBadge color="var(--c-rose)"><Scale /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Body</span>
          </Row>
          <Row href="/fitness/import">
            <IconBadge color="var(--c-slate)"><Upload /></IconBadge>
            <span className="flex-1 text-[15px] font-medium text-ink">Import</span>
          </Row>
        </Card>
      </Section>
    </div>
  );
}

function TodayCard({ day, routines }: { day: TrainingDay; routines: RoutineOption[] }) {
  const s = day.scheduled;
  const r = s.routine;
  const log = day.log;
  const color = day.color;
  const time = s.startMin != null ? formatMin(s.startMin) : null;

  // A session exists for today
  if (log) {
    const name = log.status === "skipped" ? day.plannedName : log.name;
    return (
      <div className="card overflow-hidden" style={tint(color)}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Today</span>
            <StatusChip status={log.status} />
          </div>
          <h2 className="display mt-2 text-[34px] text-ink">{name}</h2>
          {day.swapped && <p className="mt-1 text-[13.5px] text-ink-3">Planned: {day.plannedName}</p>}
          {log.status === "skipped" && log.skipReason && (
            <p className="mt-1.5 text-[14px] text-ink-2">{log.skipReason}</p>
          )}
          {log.status === "in_progress" && (
            <WorkoutClockText clock={log} className="tnum-live mt-1 block text-[15px] font-medium text-ink-2" />
          )}
          <div className="mt-5 flex items-center gap-2">
            {log.status === "in_progress" ? (
              <ButtonLink href={`/fitness/workout/${log.id}`} variant="tint" size="lg">
                Open workout
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
      </div>
    );
  }

  // Rest day
  if (!r) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Today · {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday(day.date)]}</span>
          <StatusChip status="rest" />
        </div>
        <h2 className="display mt-2 text-[34px] text-ink">{s.label ?? "Rest"}</h2>
        {s.notes && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.notes}</p>}
        <div className="mt-4 -ml-2">
          <StartOtherButton routines={routines} date={day.date} label="Start a workout anyway" />
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden" style={tint(color)}>
      <div className="h-1.5" style={{ background: colorVar(color) }} />
      <div className="p-5">
        <div className="eyebrow" style={{ color: colorVar(color) }}>
          Today{time ? ` · ${time}` : ""}
        </div>
        <h2 className="display mt-2 text-[40px] text-ink">{r.name}</h2>
        {r.focus && <p className="mt-1 text-[14.5px] text-ink-2">{r.focus}</p>}
        <div className="tnum mt-4 flex gap-5 text-[13px] text-ink-3">
          <span><b className="text-[15px] font-semibold text-ink">{r.exerciseCount}</b> exercises</span>
          <span><b className="text-[15px] font-semibold text-ink">{r.setCount}</b> sets</span>
          <span>~<b className="text-[15px] font-semibold text-ink">{r.estimatedMin}</b> min</span>
        </div>
        {s.notes && <p className="mt-3 text-[13.5px] text-ink-2">{s.notes}</p>}
        <form action={startWorkout.bind(null, r.id, day.date)} className="mt-5">
          <SubmitButton variant="tint" size="lg" className="h-14 text-[17px]">
            <Play className="size-4 fill-current" /> Start {r.name}
          </SubmitButton>
        </form>
        <div className="mt-3 flex items-center justify-between gap-2">
          <MarkDayButtons date={day.date} routines={routines} scheduledId={r.id} className="flex-1" />
        </div>
        <div className="mt-1 -ml-2 flex justify-between">
          <StartOtherButton routines={routines} date={day.date} label="Different session" />
          <Link href={`/fitness/routines/${r.id}`} className="tap inline-flex h-10 items-center px-2 text-[13.5px] font-semibold text-ink-3">
            View routine
          </Link>
        </div>
      </div>
    </div>
  );
}
