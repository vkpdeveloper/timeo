import { and, eq, isNotNull } from "drizzle-orm";
import { Flag, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Section, Skeleton, StatusPill } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getGoalHealth, getPlanStrength, type GoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatMonthDay, relativeDay } from "@/lib/dates";
import { getActiveSeason, seasonProgress } from "@/lib/queries";
import { AddGoalButton } from "./_components/goal-sheets";
import { fmtHours, fmtMin, TIERS } from "./_components/meta";
import { PlanStrengthChip, SeasonMenu } from "./_components/overview-client";

export default function GoalsPage() {
  return (
    <Suspense fallback={<GoalsSkeleton />}>
      <GoalsContent />
    </Suspense>
  );
}

function GoalsSkeleton() {
  return (
    <div className="pt-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-56" />
      <Skeleton className="mt-6 h-28" />
      <Skeleton className="mt-8 h-24" />
      <Skeleton className="mt-3 h-24" />
    </div>
  );
}

async function GoalsContent() {
  const user = await requireUser();
  const season = await getActiveSeason(user.id);

  if (!season) {
    return (
      <>
        <PageHeader title="Goals" subtitle="Twelve weeks. A few things that matter." />
        <EmptyState
          icon={<Target />}
          title="No season yet"
          body="Dump everything out, pick what matters, give it time. Takes about ten minutes."
          action={
            <ButtonLink href="/goals/setup">
              <Sparkles className="size-4" /> Plan a season
            </ButtonLink>
          }
        />
      </>
    );
  }

  const [health, completed] = await Promise.all([
    getGoalHealth(user.id, user.today),
    db
      .select({ id: t.goals.id, title: t.goals.title, color: t.goals.color })
      .from(t.goals)
      .where(and(eq(t.goals.seasonId, season.id), eq(t.goals.userId, user.id), isNotNull(t.goals.completedAt))),
  ]);
  const strength = await getPlanStrength(user.id, season.id, health);
  const progress = seasonProgress(season, user.today);
  const ended = user.today > season.endDate;
  const notStarted = user.today < season.startDate;
  const weeks = Math.ceil(progress.total / 7);

  return (
    <>
      <PageHeader
        eyebrow={`Season · Week ${progress.week} of ${weeks}`}
        title={season.name}
        subtitle={season.intention ?? undefined}
        action={
          <div className="flex gap-2">
            <AddGoalButton endDateLabel={formatMonthDay(season.endDate)} />
            <SeasonMenu season={season} />
          </div>
        }
      />

      <Card className="px-4 pt-4 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium text-ink-2">
            {notStarted ? (
              <>Starts {relativeDay(season.startDate, user.today)}</>
            ) : ended ? (
              <>Season ended {formatMonthDay(season.endDate)}</>
            ) : (
              <>
                <span className="tnum font-semibold text-ink">Day {progress.day}</span>
                <span className="tnum"> of {progress.total}</span>
                <span className="text-ink-3"> · </span>
                <span className="tnum">{progress.daysLeft} left</span>
              </>
            )}
          </div>
          <PlanStrengthChip strength={strength} />
        </div>
        <WeekBar weeks={weeks} current={notStarted ? 0 : ended ? weeks + 1 : progress.week} />
      </Card>

      {ended && (
        <Card className="mt-3 flex items-center justify-between gap-3 px-4 py-3.5">
          <p className="text-[14px] text-ink-2">Time to review and plan the next one.</p>
          <ButtonLink href="/goals/setup" size="sm">
            New season
          </ButtonLink>
        </Card>
      )}

      {health.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Target />}
          title="No open goals"
          body="Add a goal with the plus button above."
        />
      ) : (
        TIERS.map((tier) => {
          const list = health.filter((h) => h.goal.tier === tier.value);
          if (!list.length) return null;
          const hours = list.reduce((s, h) => s + h.goal.weeklyHours, 0);
          return (
            <Section key={tier.value} title={tier.heading} action={<span className="tnum">{fmtHours(hours)} / week</span>} className="mt-9">
              <div className="flex flex-col gap-2.5">
                {list.map((h) => (
                  <GoalCard key={h.goal.id} h={h} today={user.today} />
                ))}
              </div>
            </Section>
          );
        })
      )}

      {completed.length > 0 && (
        <Section title="Completed" className="mt-9">
          <Card className="overflow-hidden">
            {completed.map((g) => (
              <Link
                key={g.id}
                href={`/goals/${g.id}`}
                className="tap flex items-center gap-3 px-4 py-3.5 text-[15px] text-ink-3 active:bg-sunken [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
              >
                <span className="size-2 rounded-full" style={{ background: colorVar(g.color) }} />
                <span className="truncate line-through decoration-line-strong">{g.title}</span>
              </Link>
            ))}
          </Card>
        </Section>
      )}
    </>
  );
}

function WeekBar({ weeks, current }: { weeks: number; current: number }) {
  return (
    <div className="mt-4" aria-label={`Week ${current} of ${weeks}`}>
      <div className="flex gap-[3px]">
        {Array.from({ length: weeks }, (_, i) => {
          const w = i + 1;
          return (
            <div
              key={w}
              className={cn(
                "h-2 flex-1 rounded-full",
                w < current ? "bg-ink-2" : w === current ? "bg-accent" : "bg-sunken",
              )}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {Array.from({ length: weeks }, (_, i) => {
          const w = i + 1;
          return (
            <div
              key={w}
              className={cn(
                "tnum flex-1 text-center text-[10px] font-medium",
                w === current ? "font-semibold text-accent" : "text-ink-3",
              )}
            >
              {w === current ? `w${w}` : w}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalCard({ h, today }: { h: GoalHealth; today: string }) {
  const { goal, week } = h;
  const color = colorVar(goal.color);
  const effort = Math.max(week.doneMin, week.focusMin);
  const planned = week.targetMin ? Math.min(1, week.plannedMin / week.targetMin) : 0;
  const done = week.targetMin ? Math.min(1, effort / week.targetMin) : 0;
  const ms = h.nextMilestone;
  const overdue = ms?.dueDate != null && ms.dueDate < today;

  return (
    <Link href={`/goals/${goal.id}`} className="tap card relative block overflow-hidden py-4 pr-4 pl-5 active:bg-surface-2">
      <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 pt-0.5 text-[16px] leading-snug font-semibold tracking-tight text-ink">{goal.title}</h3>
        <StatusPill status={h.autoStatus} className="shrink-0" />
      </div>
      {h.autoStatus !== "on_track" && h.reasons[0] && <p className="mt-1 text-[13px] text-ink-3">{h.reasons[0]}</p>}

      <div className="mt-3.5">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${planned * 100}%`, background: color }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${done * 100}%`, background: color }} />
        </div>
        <div className="tnum mt-2 flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
          <span>
            <span className="font-medium text-ink-2">{fmtMin(week.plannedMin)}</span> of {fmtHours(goal.weeklyHours)} blocked
          </span>
          <span>{fmtMin(effort)} done</span>
        </div>
      </div>

      {ms && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13px]">
          <Flag className={cn("size-3.5 shrink-0", overdue ? "text-bad" : "text-ink-3")} />
          <span className="min-w-0 truncate text-ink-2">{ms.title}</span>
          {ms.dueDate && (
            <span className={cn("tnum ml-auto shrink-0", overdue ? "font-medium text-bad" : "text-ink-3")}>
              {formatMonthDay(ms.dueDate)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
