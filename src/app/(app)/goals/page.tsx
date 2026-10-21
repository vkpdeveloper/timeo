import { and, eq, isNotNull } from "drizzle-orm";
import { Check, Flag, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/motion";
import {
  AskTimi,
  Card,
  EmptyState,
  Meter,
  PageHeader,
  Row,
  Section,
  Skeleton,
  Stat,
  StatStrip,
  StatusPill,
} from "@/components/ui/primitives";
import { db, t } from "@/db";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { getGoalHealth, getPlanStrength, type GoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { tint } from "@/lib/colors";
import { formatMonthDay, relativeDay } from "@/lib/dates";
import { getActiveSeason, getGoalOptions, seasonProgress } from "@/lib/queries";
import { CoachAction } from "./[id]/goal-client";
import { AddGoalButton } from "./_components/goal-sheets";
import { fmtHours, fmtMin, tierLabel } from "./_components/meta";
import { PlanStrengthStat, SeasonMenu } from "./_components/overview-client";

export default function GoalsPage() {
  return (
    <Suspense fallback={<GoalsSkeleton />}>
      <GoalsContent />
    </Suspense>
  );
}

function GoalsSkeleton() {
  return (
    <div className="pt-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-5 h-12" />
      <Skeleton className="mt-4 h-6" />
      <Skeleton className="mt-6 h-36 rounded-[20px]" />
      <Skeleton className="mt-2.5 h-36 rounded-[20px]" />
    </div>
  );
}

const DRIFT_RANK = { off_track: 0, adjust: 1, on_track: 2 } as const;

async function GoalsContent() {
  const user = await requireUser();
  const season = await getActiveSeason(user.id);

  if (!season) {
    return (
      <>
        <PageHeader eyebrow="Goals" title="No season yet" subtitle="Twelve weeks. A few things that matter." />
        <EmptyState
          icon={<Target />}
          title="Plan your first season"
          body="Write down what you want, pick up to three goals, give each one hours a week. About ten minutes."
          action={
            <ButtonLink href="/goals/setup" variant="accent" size="sm">
              <Sparkles className="size-4" /> Plan a season
            </ButtonLink>
          }
          timi={GUIDE.firstSeason}
          timiLabel="Set it up with Timi"
        />
      </>
    );
  }

  const [health, completed, goalOptions] = await Promise.all([
    getGoalHealth(user.id, user.today),
    db
      .select({ id: t.goals.id, title: t.goals.title, color: t.goals.color })
      .from(t.goals)
      .where(and(eq(t.goals.seasonId, season.id), eq(t.goals.userId, user.id), isNotNull(t.goals.completedAt))),
    getGoalOptions(user.id),
  ]);
  const strength = await getPlanStrength(user.id, season.id, health);
  const progress = seasonProgress(season, user.today);
  const ended = user.today > season.endDate;
  const notStarted = user.today < season.startDate;
  const weeks = Math.ceil(progress.total / 7);
  const weeksLeft = weeks - progress.week;
  const ctx = { goals: goalOptions, today: user.today };

  const onTrack = health.filter((h) => h.autoStatus === "on_track").length;
  const effort = health.reduce((s, h) => s + Math.max(h.week.doneMin, h.week.focusMin), 0);
  const target = health.reduce((s, h) => s + h.week.targetMin, 0);
  const weeklyHours = health.reduce((s, h) => s + h.goal.weeklyHours, 0);
  // Timi helps with the goal drifting most (one chip per screen).
  const rescue = [...health].filter((h) => h.autoStatus !== "on_track").sort((a, b) => DRIFT_RANK[a.autoStatus] - DRIFT_RANK[b.autoStatus])[0];

  const subtitle = notStarted
    ? `Starts ${relativeDay(season.startDate, user.today).toLowerCase()}`
    : ended
      ? `Ended ${formatMonthDay(season.endDate)}`
      : `Week ${progress.week} of ${weeks} · ${weeksLeft > 0 ? `${weeksLeft} ${weeksLeft === 1 ? "week" : "weeks"} left` : `${progress.daysLeft} ${progress.daysLeft === 1 ? "day" : "days"} left`}`;

  return (
    <>
      <PageHeader
        eyebrow={`Season · ends ${formatMonthDay(season.endDate)}`}
        title={season.name}
        subtitle={<span className="font-medium text-ink">{subtitle}</span>}
        action={
          <>
            <AddGoalButton endDateLabel={formatMonthDay(season.endDate)} />
            <SeasonMenu season={season} />
          </>
        }
      />

      {health.length > 0 && (
        <StatStrip>
          <Stat
            value={`${onTrack} of ${health.length}`}
            label="goals on track"
            tone={onTrack === health.length ? "ok" : onTrack === 0 ? "bad" : "warn"}
          />
          <Stat value={<CountUp value={effort} format="duration" />} label={`of ${fmtMin(target)} done this week`} />
          <PlanStrengthStat strength={strength} />
        </StatStrip>
      )}

      <SeasonBar
        weeks={weeks}
        current={notStarted ? 0 : ended ? weeks + 1 : progress.week}
        start={season.startDate}
        end={season.endDate}
        intention={season.intention}
      />

      {ended && (
        <Card className="mt-4 flex items-center justify-between gap-3 py-3 pr-3 pl-4">
          <p className="text-[14px] text-ink-2">Review it, then plan the next one.</p>
          <ButtonLink href="/goals/setup" variant="accent" size="sm">
            New season
          </ButtonLink>
        </Card>
      )}

      {health.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Target />}
          title="No open goals"
          body="Add one with the plus button. Three is plenty for twelve weeks."
          timi={GUIDE.canIFit("a new goal")}
          timiLabel="What fits?"
        />
      ) : (
        <Section title="Goals" count={`${fmtHours(weeklyHours)} a week`} stagger bodyClassName="flex flex-col gap-2.5">
          {health.map((h) => (
            <GoalCard key={h.goal.id} h={h} today={user.today} ctx={ctx} rescue={h === rescue} />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Completed" count={completed.length} card>
          {completed.map((g) => (
            <Row
              key={g.id}
              href={`/goals/${g.id}`}
              icon={<Check strokeWidth={2.6} />}
              iconColor={g.color}
              title={<span className="text-ink-3 line-through decoration-line-strong">{g.title}</span>}
            />
          ))}
        </Section>
      )}
    </>
  );
}

/** Twelve week segments: past weeks filled, this week in accent. */
function SeasonBar({
  weeks,
  current,
  start,
  end,
  intention,
}: {
  weeks: number;
  current: number;
  start: string;
  end: string;
  intention: string | null;
}) {
  return (
    <div className="mt-4 px-1">
      <div className="meter-grow flex gap-[3px]" role="img" aria-label={`Week ${current} of ${weeks}`}>
        {Array.from({ length: weeks }, (_, i) => {
          const w = i + 1;
          return (
            <span
              key={w}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                w < current ? "bg-ink-3" : w === current ? "bg-accent" : "bg-sunken",
              )}
            />
          );
        })}
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[11.5px] font-medium text-ink-3">
        <span>{formatMonthDay(start)}</span>
        <span>{formatMonthDay(end)}</span>
      </div>
      {intention && <p className="mt-2 text-[13.5px] leading-snug text-ink-3 italic">{intention}</p>}
    </div>
  );
}

type Ctx = Parameters<typeof CoachAction>[0]["ctx"];

function GoalCard({ h, today, ctx, rescue }: { h: GoalHealth; today: string; ctx: Ctx; rescue: boolean }) {
  const { goal, week } = h;
  const effort = Math.max(week.doneMin, week.focusMin);
  const total = Math.max(week.targetMin, week.plannedMin, effort, 1);
  const ms = h.nextMilestone;
  const overdue = ms?.dueDate != null && ms.dueDate < today;
  const drifting = h.autoStatus !== "on_track";
  // Only surface the coach's step when something needs fixing; on-track cards stay calm.
  const rec = h.recommendation && (drifting || h.recommendation.kind === "protect_time") ? h.recommendation : undefined;

  return (
    <div className="card overflow-hidden" style={tint(goal.color)}>
      <Link href={`/goals/${goal.id}`} className="tap-row block px-4 pt-3.5 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
              <span className="size-2 rounded-full bg-tint" />
              {tierLabel(goal.tier)}
            </div>
            <h3 className="mt-1 text-[16px] leading-snug font-semibold tracking-tight text-ink">{goal.title}</h3>
          </div>
          <StatusPill status={h.autoStatus} className="mt-0.5 shrink-0" />
        </div>
        {drifting && h.reasons[0] && <p className="mt-1 text-[13px] text-ink-2">{h.reasons[0]}</p>}

        <div className="tnum mt-3 flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-ink-3">
            <span className="font-semibold text-ink">{fmtMin(effort)}</span> of {fmtMin(week.targetMin)} this week
          </span>
          <span className="text-ink-3">{fmtMin(week.plannedMin)} blocked</span>
        </div>
        <Meter
          className="mt-2"
          height={6}
          legend={false}
          total={total}
          segments={[
            { kind: "done", value: effort },
            { kind: "planned", value: Math.max(0, week.plannedMin - effort) },
          ]}
        />

        {ms && (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13px]">
            <Flag className={cn("size-3.5 shrink-0", overdue ? "text-bad" : "text-ink-3")} />
            <span className="min-w-0 truncate text-ink-2">{ms.title}</span>
            {ms.dueDate && (
              <span className={cn("tnum ml-auto shrink-0", overdue ? "font-medium text-bad" : "text-ink-3")}>
                {overdue ? "Overdue · " : ""}
                {formatMonthDay(ms.dueDate)}
              </span>
            )}
          </div>
        )}
      </Link>

      {(rescue || rec) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
          {rescue ? (
            <AskTimi prompt={GUIDE.rescueGoal(goal.title)} label="Find a fix with Timi" />
          ) : (
            rec && <CoachAction rec={rec} ctx={ctx} goalTitle={goal.title} compact />
          )}
        </div>
      )}
    </div>
  );
}
