import { ArrowRight, Droplet, Dumbbell, Play } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommandBar } from "@/components/ai/command-bar";
import { Card, Section, SectionLink, Skeleton } from "@/components/ui/primitives";
import type { Block } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration, formatLongDate, formatMin, nowMinIn } from "@/lib/dates";
import { getActiveSeason, getDayBlocks, getGoalOptions, getTodayTasks, seasonProgress } from "@/lib/queries";
import { CoachAction } from "./goals/[id]/goal-client";
import { getDailyRead, getGoalHealth } from "@/lib/coach";
import { getTodayTraining, type TodayTraining } from "@/lib/fitness";
import { ProgressBar, ProgressRing, StatusPill } from "@/components/ui/primitives";
import { InstallBanner } from "@/components/shell/install";
import { TodayTasks } from "./today-tasks";
import { todayHeadline } from "./today-headline";

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const user = await requireUser();
  const nowMin = nowMinIn(user.timezone);
  const [season, goals, blocks, tasks, read, health, training] = await Promise.all([
    getActiveSeason(user.id),
    getGoalOptions(user.id),
    getDayBlocks(user.id, user.today),
    getTodayTasks(user.id, user.today),
    getDailyRead(user),
    getGoalHealth(user.id, user.today),
    getTodayTraining(user.id, user.today),
  ]);
  const drifting = health.find((h) => h.autoStatus !== "on_track" && h.recommendation);
  const progress = season ? seasonProgress(season, user.today) : null;
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const headline = todayHeadline({ nowMin, blocks, tasks, training });

  return (
    <div className="fade-up">
      <header className="pt-6 pb-5 lg:pt-10">
        <div className="eyebrow mb-2">
          {formatLongDate(user.today)}
          {progress && ` · Day ${progress.day} of ${progress.total}`}
        </div>
        <h1 className="display text-[34px] text-balance text-ink lg:text-[40px]">{headline.title}</h1>
        <p className="mt-1.5 text-[15px] leading-snug text-ink-3">{headline.line}</p>
      </header>

      <CommandBar />
      <InstallBanner />

      {!season && (
        <Card className="mt-5 overflow-hidden p-5">
          <div className="eyebrow">Start here</div>
          <p className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink">Plan your 12-week season</p>
          <p className="mt-1 text-[14px] text-ink-3">Pick 2–3 goals. Give them time on your calendar.</p>
          <Link href="/goals/setup" className="tap mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg">
            Set up season <ArrowRight className="size-4" />
          </Link>
        </Card>
      )}

      {season && (
        <Card className="mt-5 p-4">
          <div className="eyebrow">Coach</div>
          <p className="mt-1.5 text-[17px] leading-snug font-semibold tracking-tight text-ink">{read.headline}</p>
          {read.detail && <p className="mt-1 text-[14px] text-ink-3">{read.detail}</p>}
          {drifting?.recommendation && (
            <div className="mt-3.5 border-t border-line pt-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-medium text-ink-2">{drifting.goal.title}</span>
                <StatusPill status={drifting.autoStatus} />
              </div>
              <CoachAction rec={drifting.recommendation} ctx={{ goals, today: user.today }} goalTitle={drifting.goal.title} />
            </div>
          )}
        </Card>
      )}

      <NowNext blocks={blocks} nowMin={nowMin} goalById={goalById} />

      <Section title="Today" action={<SectionLink href="/plan">Plan</SectionLink>}>
        <Agenda blocks={blocks} nowMin={nowMin} goalById={goalById} />
      </Section>

      <Section title="Tasks">
        <TodayTasks tasks={tasks} goals={goals} today={user.today} />
      </Section>

      <Section title="Body" action={<SectionLink href="/fitness">Fitness</SectionLink>}>
        <TrainingCard training={training} />
      </Section>
    </div>
  );
}

type GoalMap = Map<string, { id: string; title: string; color: string }>;

function NowNext({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  const open = blocks.filter((b) => !b.doneAt && !b.skippedAt);
  const now = open.find((b) => b.startMin <= nowMin && b.endMin > nowMin);
  const next = open.find((b) => b.startMin > nowMin);
  const b = now ?? next;
  if (!b) return null;
  const goal = b.goalId ? goalById.get(b.goalId) : undefined;
  const color = goal ? goal.color : "slate";
  const pct = now ? (nowMin - b.startMin) / (b.endMin - b.startMin) : 0;
  return (
    <div
      className="card mt-5 overflow-hidden p-4"
      style={{ background: `linear-gradient(135deg, ${softVar(color)} 0%, var(--surface) 70%)` }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold" style={{ color: colorVar(color) }}>
            {now ? `Now · until ${formatMin(b.endMin)}` : `Next · ${formatMin(b.startMin)} (in ${formatDuration(b.startMin - nowMin)})`}
          </div>
          <div className="mt-0.5 truncate text-[17px] font-semibold tracking-tight text-ink">{b.title}</div>
          {goal && <div className="mt-0.5 truncate text-[13px] text-ink-3">{goal.title}</div>}
        </div>
        {(b.kind === "focus" || b.kind === "admin") && (
          <Link
            href={`/focus?block=${b.id}`}
            className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-white"
            style={{ background: colorVar(color) }}
          >
            <Play className="size-3.5 fill-current" /> Focus
          </Link>
        )}
        {b.kind === "workout" && (
          <Link href="/fitness" className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg">
            Train
          </Link>
        )}
      </div>
      {now && (
        <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: colorVar(color) }} />
        </div>
      )}
    </div>
  );
}

function Agenda({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  if (!blocks.length) {
    return (
      <Link href="/plan" className="card tap flex items-center justify-between px-4 py-4 text-[14px] text-ink-3">
        Nothing blocked yet. Give your goals a slot.
        <ArrowRight className="size-4" />
      </Link>
    );
  }
  return (
    <div className="card overflow-hidden py-1.5">
      {blocks.map((b) => {
        const goal = b.goalId ? goalById.get(b.goalId) : undefined;
        const past = b.endMin <= nowMin;
        const live = b.startMin <= nowMin && b.endMin > nowMin;
        return (
          <Link
            key={b.id}
            href={`/plan?date=${b.date}`}
            className={cn("tap flex items-center gap-3 px-4 py-2.5 active:bg-sunken", (past || b.skippedAt) && !live && "opacity-55")}
          >
            <div className="tnum w-[62px] shrink-0 text-[12.5px] font-medium text-ink-3">{formatMin(b.startMin, true)}</div>
            <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: goal ? colorVar(goal.color) : "var(--line-strong)" }} />
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[14.5px] font-medium text-ink", (b.doneAt || b.skippedAt) && "line-through decoration-ink-3")}>
                {b.title}
              </div>
              <div className="text-[12px] text-ink-3">{formatDuration(b.endMin - b.startMin)}{goal ? ` · ${goal.title}` : ""}</div>
            </div>
            {live && <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />}
          </Link>
        );
      })}
    </div>
  );
}

function TrainingCard({ training }: { training: TodayTraining }) {
  const { scheduled, log, nutrition, water } = training;
  const status = log?.status;
  const statusText =
    status === "completed" ? "Done" : status === "skipped" ? "Skipped" : status === "unlogged" ? "Done · not logged" : status === "in_progress" ? "In progress" : null;
  const kcalTarget = nutrition.target?.calories ?? 0;
  const proteinTarget = nutrition.target?.proteinG ?? 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href={log && status === "in_progress" ? `/fitness/workout/${log.id}` : "/fitness"} className="card tap flex items-center gap-3.5 p-4">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: softVar(scheduled.color), color: colorVar(scheduled.color) }}
        >
          <Dumbbell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink-3">{scheduled.isRest ? "Rest day" : "Training"}</div>
          <div className="truncate text-[16px] font-semibold tracking-tight text-ink">{log?.name ?? scheduled.name}</div>
          <div className="truncate text-[12.5px] text-ink-3">
            {statusText ?? (scheduled.isRest ? (scheduled.notes ?? "Recover well") : `${scheduled.exerciseCount} exercises · ${scheduled.setCount} sets${scheduled.startMin != null ? ` · ${formatMin(scheduled.startMin, true)}` : ""}`)}
          </div>
        </div>
        {!scheduled.isRest && !status && (
          <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-bg">
            <Play className="size-3 fill-current" /> Start
          </span>
        )}
      </Link>
      <Link href="/fitness/nutrition" className="card tap flex items-center gap-4 p-4">
        <ProgressRing value={kcalTarget ? nutrition.calories / kcalTarget : 0} size={52} stroke={6} color="var(--c-amber)">
          <span className="tnum text-[11px] font-semibold text-ink">{kcalTarget ? `${Math.round((nutrition.calories / kcalTarget) * 100)}%` : "–"}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium text-ink-2">
              <span className="tnum font-semibold text-ink">{nutrition.calories}</span>
              {kcalTarget ? ` / ${kcalTarget}` : ""} kcal
            </span>
            <span className="tnum text-ink-3">
              {nutrition.proteinG}
              {proteinTarget ? `/${proteinTarget}` : ""}g P
            </span>
          </div>
          <ProgressBar value={proteinTarget ? nutrition.proteinG / proteinTarget : 0} color="var(--c-rose)" />
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <Droplet className="size-3.5 text-[var(--c-sky)]" />
            <span className="tnum">
              {(water.ml / 1000).toFixed(1)} / {(water.targetMl / 1000).toFixed(1)} L
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="pt-6 lg:pt-10">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-20 w-56" />
      <Skeleton className="mt-6 h-[54px] rounded-[22px]" />
      <Skeleton className="mt-5 h-24" />
      <Skeleton className="mt-8 h-40" />
      <Skeleton className="mt-8 h-32" />
    </div>
  );
}
