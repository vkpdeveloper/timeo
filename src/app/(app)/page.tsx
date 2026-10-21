import { and, eq } from "drizzle-orm";
import { ArrowRight, Check, ChevronRight, Dumbbell, Moon, Play } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommandBar } from "@/components/ai/command-bar";
import { InstallBanner } from "@/components/shell/install";
import { ButtonLink } from "@/components/ui/button";
import { CountUp, Stagger } from "@/components/ui/motion";
import {
  AskTimi,
  Card,
  EmptyState,
  PageHeader,
  ProgressRing,
  Row,
  Section,
  SectionLink,
  Skeleton,
  Stat,
  StatStrip,
  StatusPill,
  TimeMeter,
} from "@/components/ui/primitives";
import { db, t } from "@/db";
import type { Block } from "@/db/schema";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getDailyRead, getGoalHealth } from "@/lib/coach";
import { colorVar, tint } from "@/lib/colors";
import { formatDuration, formatMin, formatMonthDay, formatWeekdayShort, nowMinIn } from "@/lib/dates";
import { getTodayTraining, type TodayTraining } from "@/lib/fitness";
import { getActiveSeason, getDayBlocks, getGoalOptions, getTodayTasks, seasonProgress } from "@/lib/queries";
import { CoachAction } from "./goals/[id]/goal-client";
import { dayBounds, dayCapacity, todayHeadline } from "./today-headline";
import { TodayTasks } from "./today-tasks";

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

/** A day with this much unblocked time left gets a "what fits" nudge from Timi. */
const LIGHT_DAY_MIN = 3 * 60;

async function Today() {
  const user = await requireUser();
  const nowMin = nowMinIn(user.timezone);
  const [season, goals, blocks, tasks, read, health, training, sessions] = await Promise.all([
    getActiveSeason(user.id),
    getGoalOptions(user.id),
    getDayBlocks(user.id, user.today),
    getTodayTasks(user.id, user.today),
    getDailyRead(user),
    getGoalHealth(user.id, user.today),
    getTodayTraining(user.id, user.today),
    db
      .select({ focusedMin: t.focusSessions.focusedMin })
      .from(t.focusSessions)
      .where(and(eq(t.focusSessions.userId, user.id), eq(t.focusSessions.date, user.today))),
  ]);
  const drifting = health.find((h) => h.autoStatus !== "on_track" && h.recommendation);
  const progress = season ? seasonProgress(season, user.today) : null;
  const goalById: GoalMap = new Map(goals.map((g) => [g.id, g]));
  const headline = todayHeadline({ nowMin, blocks, tasks, training });

  const live = blocks.filter((b) => !b.skippedAt);
  const bounds = dayBounds(user.dayStartMin, user.dayEndMin, live);
  const cap = dayCapacity({ blocks, nowMin, bounds });
  const blocksLeft = live.filter((b) => !b.doneAt && b.endMin > nowMin).length;
  const tasksLeft = tasks.filter((x) => !x.doneAt).length;
  const focusMin = sessions.reduce((s, f) => s + f.focusedMin, 0);
  const dayOver = nowMin >= bounds.end;
  const light = !dayOver && (live.length === 0 || cap.freeMin >= LIGHT_DAY_MIN);

  return (
    <Stagger step={45}>
      <PageHeader
        eyebrow={`${formatWeekdayShort(user.today)}, ${formatMonthDay(user.today)}${progress ? ` · Day ${progress.day} of ${progress.total}` : ""}`}
        title={headline.title}
        subtitle={<span className="text-ink-3">{headline.line}</span>}
        className="pb-3.5!"
      />

      <div>
        <StatStrip className="[&>*]:px-2! [&>*:first-child]:pl-1!">
          <Stat
            value={<CountUp value={cap.freeMin} format="duration" />}
            label={dayOver ? "day's done" : `free till ${formatMin(bounds.end, true)}`}
          />
          <Stat value={<CountUp value={blocksLeft} />} label={blocksLeft === 1 ? "block left" : "blocks left"} />
          <Stat value={<CountUp value={tasksLeft} />} label={tasksLeft === 1 ? "task open" : "tasks open"} />
          <Stat value={<CountUp value={focusMin} format="duration" />} label="focused" />
        </StatStrip>
        <TimeMeter className="mt-3.5" doneMin={cap.doneMin} plannedMin={cap.plannedMin} freeMin={cap.freeMin} />
      </div>

      <NowNext blocks={blocks} nowMin={nowMin} goalById={goalById} />

      <CommandBar className="mt-3" />
      <InstallBanner />

      {season ? (
        <Card className="mt-3 p-4">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <span className="eyebrow">Coach</span>
            {drifting && <StatusPill status={drifting.autoStatus} className="-my-1" />}
          </div>
          <p className="mt-1 text-[15.5px] leading-snug font-semibold tracking-tight text-ink">{read.headline}</p>
          {drifting ? (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-3">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(drifting.goal.color) }} />
              <span className="truncate">
                <span className="text-ink-2">{drifting.goal.title}</span>
                {drifting.reasons[0] && ` · ${drifting.reasons[0].charAt(0).toLowerCase()}${drifting.reasons[0].slice(1)}`}
              </span>
            </p>
          ) : (
            read.detail && <p className="mt-0.5 text-[13px] text-ink-3">{read.detail}</p>
          )}
          {(drifting?.recommendation || light) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {drifting?.recommendation && (
                <CoachAction
                  compact
                  rec={drifting.recommendation}
                  ctx={{ goals, today: user.today }}
                  goalTitle={drifting.goal.title}
                />
              )}
              {light && (
                <AskTimi
                  prompt={GUIDE.planToday}
                  label={live.length ? `What fits in ${formatDuration(cap.freeMin)}?` : "Plan my day"}
                />
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="mt-3 p-4">
          <div className="eyebrow">Start here</div>
          <p className="mt-1 text-[15.5px] font-semibold tracking-tight text-ink">Plan your 12-week season</p>
          <p className="mt-0.5 text-[13px] text-ink-3">Pick 2–3 goals. Give them time on your calendar.</p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <ButtonLink href="/goals/setup" variant="primary" size="sm">
              Set up season <ArrowRight className="size-4" />
            </ButtonLink>
            <AskTimi prompt={GUIDE.firstSeason} label="Set it up with Timi" />
          </div>
        </Card>
      )}

      {/* desktop: schedule on the left, tasks and body on the right */}
      <div className="mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <Section
          title="Schedule"
          count={blocksLeft ? `${blocksLeft} left` : live.length ? "All done" : undefined}
          action={<SectionLink href="/plan">Plan</SectionLink>}
          card
        >
          <Agenda blocks={blocks} nowMin={nowMin} goalById={goalById} />
        </Section>

        <div className="mt-6 lg:mt-0">
          <TodayTasks tasks={tasks} goals={goals} today={user.today} />

          <Section title="Body" action={<SectionLink href="/fitness">Fitness</SectionLink>} card>
            <BodyRows training={training} />
          </Section>
        </div>
      </div>
    </Stagger>
  );
}

type GoalMap = Map<string, { id: string; title: string; color: string }>;

const KIND_NAME: Record<Block["kind"], string> = {
  focus: "Focus",
  meeting: "Meeting",
  workout: "Workout",
  meal: "Meal",
  life: "Life",
  admin: "Admin",
};

function NowNext({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  const open = blocks.filter((b) => !b.doneAt && !b.skippedAt);
  const now = open.find((b) => b.startMin <= nowMin && b.endMin > nowMin);
  const upcoming = open.filter((b) => b.startMin > nowMin);
  const b = now ?? upcoming[0];
  if (!b) return null;
  const then = now ? upcoming[0] : upcoming[1];
  const goal = b.goalId ? goalById.get(b.goalId) : undefined;
  const pct = now ? (nowMin - b.startMin) / (b.endMin - b.startMin) : 0;
  const action =
    b.kind === "focus" || b.kind === "admin"
      ? {
          href: `/focus?block=${b.id}`,
          label: now ? "Start focus" : "Start early",
        }
      : b.kind === "workout"
        ? { href: "/fitness", label: "Start workout" }
        : null;

  return (
    <div
      className="card mt-5 overflow-hidden"
      style={{
        ...tint(goal?.color ?? "slate"),
        background: "linear-gradient(135deg, color-mix(in oklab, var(--tint) 13%, var(--surface)) 0%, var(--surface) 62%)",
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          {now && (
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-tint opacity-60" />
              <span className="relative size-2 rounded-full bg-tint" />
            </span>
          )}
          <span className="text-tint">{now ? "Now" : "Next"}</span>
          <span className="tnum truncate font-medium text-ink-3">
            {now
              ? `· until ${formatMin(b.endMin, true)} · ${formatDuration(b.endMin - nowMin)} left`
              : `· ${formatMin(b.startMin, true)}, in ${formatDuration(b.startMin - nowMin)}`}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] leading-tight font-semibold tracking-tight text-ink">{b.title}</div>
            <div className="mt-0.5 truncate text-[13px] text-ink-3">
              {goal?.title ?? KIND_NAME[b.kind]} · {formatDuration(b.endMin - b.startMin)}
            </div>
          </div>
          {action && (
            <ButtonLink href={action.href} variant="accent" size="md" className="px-4!">
              <Play className="size-3.5 fill-current" /> {action.label}
            </ButtonLink>
          )}
        </div>
        {now && (
          <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-sunken">
            <div className="meter-grow h-full rounded-full bg-tint" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>
      {then && (
        <Link
          href={`/plan?date=${then.date}`}
          className="tap-row flex h-11 items-center gap-2.5 border-t border-line px-4 text-[13px]"
        >
          <span className="font-medium text-ink-3">Then</span>
          <span
            className="h-3.5 w-[3px] shrink-0 rounded-full"
            style={{
              background:
                then.goalId && goalById.get(then.goalId) ? colorVar(goalById.get(then.goalId)!.color) : "var(--line-strong)",
            }}
          />
          <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{then.title}</span>
          <span className="tnum shrink-0 text-ink-3">{formatMin(then.startMin, true)}</span>
        </Link>
      )}
    </div>
  );
}

const PARTS = [
  { label: "Morning", from: 0, to: 12 * 60 },
  { label: "Afternoon", from: 12 * 60, to: 17 * 60 },
  { label: "Evening", from: 17 * 60, to: 24 * 60 },
];

function Agenda({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  if (!blocks.length) {
    return (
      <EmptyState
        bare
        className="py-6!"
        title="Nothing blocked yet"
        body="Give the goal that matters a slot today."
        action={
          <ButtonLink href="/plan" variant="secondary" size="sm">
            Open plan
          </ButtonLink>
        }
      />
    );
  }
  return (
    <>
      {PARTS.map((part) => {
        const list = blocks.filter((b) => b.startMin >= part.from && b.startMin < part.to);
        if (!list.length) return null;
        const live = list.filter((b) => !b.skippedAt);
        const done = live.filter((b) => b.doneAt).length;
        const behind = list.every((b) => b.doneAt || b.skippedAt || b.endMin <= nowMin);
        const current = nowMin >= part.from && nowMin < part.to;
        const minutes = live.reduce((s, b) => s + b.endMin - b.startMin, 0);
        return (
          <details key={part.label} open={!behind || current} className="group/part">
            <summary className="tap-row flex h-10 cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
              <span className={cn("eyebrow", current && "text-ink-2")}>{part.label}</span>
              <span className="tnum min-w-0 flex-1 truncate text-[12px] text-ink-3">
                {behind ? `· ${done} of ${live.length} done` : `· ${formatDuration(minutes)}`}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open/part:rotate-90" />
            </summary>
            <div className="pb-1.5">
              {list.map((b) => (
                <AgendaRow key={b.id} block={b} nowMin={nowMin} goal={b.goalId ? goalById.get(b.goalId) : undefined} />
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

function AgendaRow({ block: b, nowMin, goal }: { block: Block; nowMin: number; goal?: { title: string; color: string } }) {
  const live = !b.doneAt && !b.skippedAt && b.startMin <= nowMin && b.endMin > nowMin;
  const past = b.endMin <= nowMin;
  const missed = past && !b.doneAt && !b.skippedAt;
  const quiet = !live && (b.doneAt || b.skippedAt || past);
  const color = goal?.color;
  return (
    <Link
      href={`/plan?date=${b.date}`}
      className={cn("tap-row relative mx-1.5 flex min-h-12 items-center gap-3 rounded-[14px] px-2.5 py-1.5")}
      style={
        live
          ? {
              ...tint(color ?? "slate"),
              background: "color-mix(in oklab, var(--tint) 12%, transparent)",
            }
          : undefined
      }
    >
      <span className={cn("tnum w-[50px] shrink-0 text-[12.5px] font-medium", live ? "text-ink" : "text-ink-3")}>
        {formatMin(b.startMin, true)}
      </span>
      <span
        className={cn("h-7 w-[3px] shrink-0 rounded-full", quiet && "opacity-50")}
        style={{ background: color ? colorVar(color) : "var(--line-strong)" }}
      />
      <span className={cn("min-w-0 flex-1", quiet && "opacity-55")}>
        <span className={cn("block truncate text-[14.5px] font-medium text-ink", b.skippedAt && "line-through decoration-ink-3")}>
          {b.title}
        </span>
        <span className="tnum block truncate text-[12px] text-ink-3">
          {formatDuration(b.endMin - b.startMin)}
          {goal ? ` · ${goal.title}` : ""}
        </span>
      </span>
      {live ? (
        <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[11px] font-semibold text-tint-ink">Now</span>
      ) : b.doneAt ? (
        <Check className="size-4 shrink-0 text-ink-3" strokeWidth={2.6} />
      ) : b.skippedAt ? (
        <span className="shrink-0 text-[12px] text-ink-3">Skipped</span>
      ) : missed ? (
        <span className="shrink-0 text-[12px] text-ink-3">Missed</span>
      ) : null}
    </Link>
  );
}

function BodyRows({ training }: { training: TodayTraining }) {
  const { scheduled, log, nutrition, water } = training;
  const status = log?.status;
  const statusText =
    status === "completed"
      ? "Done"
      : status === "skipped"
        ? "Skipped"
        : status === "unlogged"
          ? "Not logged"
          : status === "in_progress"
            ? "In progress"
            : null;
  const kcalTarget = nutrition.target?.calories ?? 0;
  const proteinTarget = nutrition.target?.proteinG ?? 0;
  const of = (v: number, target: number, unit: string) => (target ? `${v} of ${target}${unit}` : `${v}${unit}`);
  const litres = (ml: number) => (ml / 1000).toFixed(1);

  return (
    <>
      <Row
        href={log && status === "in_progress" ? `/fitness/workout/${log.id}` : "/fitness"}
        icon={scheduled.isRest ? <Moon /> : <Dumbbell />}
        iconColor={scheduled.isRest ? undefined : scheduled.color}
        title={scheduled.isRest && !log ? "Rest day" : (log?.name ?? scheduled.name)}
        subtitle={
          scheduled.isRest && !log
            ? (scheduled.notes ?? scheduled.name)
            : `${scheduled.exerciseCount} exercises · ${scheduled.setCount} sets${scheduled.startMin != null ? ` · ${formatMin(scheduled.startMin, true)}` : ""}`
        }
        value={statusText ?? (scheduled.isRest ? undefined : "To do")}
      />
      <Row href="/fitness/nutrition">
        <ProgressRing value={kcalTarget ? nutrition.calories / kcalTarget : 0} size={32} stroke={4} color="var(--c-amber)" />
        <div className="min-w-0 flex-1">
          <div className="tnum truncate text-[15px] font-medium text-ink">{of(nutrition.calories, kcalTarget, " kcal")}</div>
          <div className="tnum truncate text-[13px] text-ink-3">
            {of(nutrition.proteinG, proteinTarget, " g")} protein · {litres(water.ml)} of {litres(water.targetMl)} L water
          </div>
        </div>
      </Row>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div className="pt-5 lg:pt-10">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2.5 h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-48" />
      <Skeleton className="mt-5 h-12" />
      <Skeleton className="mt-3.5 h-2 rounded-full" />
      <Skeleton className="mt-5 h-[120px] rounded-[20px]" />
      <Skeleton className="mt-3 h-[52px] rounded-[22px]" />
      <Skeleton className="mt-6 h-48 rounded-[20px]" />
    </div>
  );
}
