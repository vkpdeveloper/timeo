import { and, eq, isNotNull } from "drizzle-orm";
import { Check, ChevronRight, Target } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import {
  AskTimi,
  Card,
  EmptyState,
  LinearProgress,
  Meter,
  PageHeader,
  Row,
  Section,
  SectionLink,
  Skeleton,
} from "@/components/ui/primitives";
import { db, t } from "@/db";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { getGoalHealth, getPlanStrength, type GoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatMonthDay, relativeDay, startOfWeek, weekday } from "@/lib/dates";
import { getActiveSeason, seasonProgress } from "@/lib/queries";
import { fmtMin } from "./_components/meta";
import { AddGoalRow, SeasonMenu } from "./_components/overview-client";
import { WeekStrip } from "./_components/week-strip";

export default function SeasonPage() {
  return (
    <Suspense fallback={<SeasonSkeleton />}>
      <SeasonContent />
    </Suspense>
  );
}

function SeasonSkeleton() {
  return (
    <div className="pt-5 lg:pt-10">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-6 h-2" />
      <Skeleton className="mt-8 h-[168px] rounded-[16px]" />
      <Skeleton className="mt-8 h-[228px] rounded-[16px]" />
    </div>
  );
}

const DRIFT_RANK = { off_track: 0, adjust: 1, on_track: 2 } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function SeasonContent() {
  const user = await requireUser();
  const season = await getActiveSeason(user.id);

  if (!season) {
    return (
      <>
        <PageHeader eyebrow="Season" title="No season yet" subtitle="Twelve weeks. A few things that matter." />
        <EmptyState
          icon={<Target />}
          title="Plan your first season"
          body="Write down what you want, pick up to three goals, give each one hours a week. About ten minutes."
          action={
            <ButtonLink href="/app/goals/setup" variant="accent" size="sm">
              Plan a season
            </ButtonLink>
          }
          timi={GUIDE.firstSeason}
          timiLabel="Set it up with Timi"
        />
      </>
    );
  }

  const weekStart = startOfWeek(user.today);
  const [health, completed, reviewed] = await Promise.all([
    getGoalHealth(user.id, user.today),
    db
      .select({ id: t.goals.id, title: t.goals.title, color: t.goals.color })
      .from(t.goals)
      .where(and(eq(t.goals.seasonId, season.id), eq(t.goals.userId, user.id), isNotNull(t.goals.completedAt))),
    db
      .select({ id: t.reflections.id })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "weekly"), eq(t.reflections.date, weekStart)))
      .get(),
  ]);
  const strength = health.length > 0 ? await getPlanStrength(user.id, season.id, health) : null;

  const progress = seasonProgress(season, user.today);
  const ended = user.today > season.endDate;
  const notStarted = user.today < season.startDate;
  const weeks = Math.ceil(progress.total / 7);
  const weeksLeft = weeks - progress.week;
  const endLabel = formatMonthDay(season.endDate);

  const subtitle = notStarted
    ? `Starts ${relativeDay(season.startDate, user.today).toLowerCase()}`
    : ended
      ? `Ended ${endLabel}`
      : `Week ${progress.week} of ${weeks}, ${weeksLeft > 0 ? `${plural(weeksLeft, "week")} left` : `${plural(progress.daysLeft, "day")} left`}`;

  // Timi helps with the goal drifting most: one line, one action.
  const rescue = [...health]
    .filter((h) => h.autoStatus !== "on_track")
    .sort((a, b) => DRIFT_RANK[a.autoStatus] - DRIFT_RANK[b.autoStatus])[0];

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={`Season ends ${endLabel}`}
        title={season.name}
        subtitle={subtitle}
        action={<SeasonMenu season={season} strength={strength} endDateLabel={endLabel} />}
      />

      <WeekStrip
        weeks={weeks}
        current={notStarted ? 0 : ended ? weeks + 1 : progress.week}
        dayOfWeek={weekday(user.today)}
        startLabel={formatMonthDay(season.startDate)}
        endLabel={endLabel}
      />
      {season.intention && <p className="mt-3 text-[14px] leading-snug text-ink-2">{season.intention}</p>}

      {ended ? (
        <Card className="mt-6 flex items-center justify-between gap-3 py-3 pr-3 pl-4">
          <p className="text-[14.5px] text-ink-2">Review it, then plan the next one.</p>
          <ButtonLink href="/app/goals/setup" variant="accent" size="sm">
            New season
          </ButtonLink>
        </Card>
      ) : (
        !notStarted && (
          <ThisWeek
            health={health}
            weekNo={progress.week}
            today={user.today}
            reviewed={reviewed != null}
          />
        )
      )}

      {health.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Target />}
          title="No open goals"
          body="Add one from the menu at the top. Three is plenty for twelve weeks."
          timi={GUIDE.canIFit("a new goal")}
          timiLabel="What fits?"
        />
      ) : (
        <Section title="Goals" className="mt-8" card stagger>
          {health.map((h) => (
            <GoalRow key={h.goal.id} h={h} today={user.today} />
          ))}
          <AddGoalRow endDateLabel={endLabel} />
        </Section>
      )}

      {rescue && (
        <div className="rise mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1" style={{ ["--delay" as string]: "200ms" }}>
          <p className="min-w-0 text-[13.5px] leading-snug text-ink-2">
            <span className="font-medium text-ink">{rescue.goal.title}</span> is drifting.
          </p>
          <AskTimi prompt={GUIDE.rescueGoal(rescue.goal.title)} label="Find a fix" />
        </div>
      )}

      {completed.length > 0 && (
        <Section title="Completed" className="mt-8" card>
          {completed.map((g) => (
            <Row
              key={g.id}
              href={`/app/goals/${g.id}`}
              icon={<Check strokeWidth={2.4} />}
              title={<span className="text-ink-2 line-through decoration-line-strong">{g.title}</span>}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

/** Hours toward goals this week and the way into this week's review, in one card. */
function ThisWeek({
  health,
  weekNo,
  today,
  reviewed,
}: {
  health: GoalHealth[];
  weekNo: number;
  today: string;
  reviewed: boolean;
}) {
  const effort = health.reduce((s, h) => s + Math.max(h.week.doneMin, h.week.focusMin), 0);
  const target = health.reduce((s, h) => s + h.week.targetMin, 0);
  const planned = health.reduce((s, h) => s + Math.max(h.week.plannedMin, Math.max(h.week.doneMin, h.week.focusMin)), 0);
  const onTrack = health.filter((h) => h.autoStatus === "on_track").length;
  const daysLeft = 6 - weekday(today);

  const facts = [
    planned > effort ? `${fmtMin(planned - effort)} more blocked` : null,
    health.length > 0 ? `${onTrack} of ${health.length} on track` : null,
  ].filter(Boolean);

  return (
    <section className="rise mt-6" style={{ ["--delay" as string]: "80ms" }}>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">This week</h2>
        <SectionLink href="/app/review">Check-ins</SectionLink>
      </div>
      <div className="card card-list overflow-hidden">
        {health.length > 0 && (
          <div className="px-4 pt-3.5 pb-3.5">
            <div className="tnum flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold tracking-tight text-ink">{fmtMin(effort)}</span>
              <span className="text-[14px] text-ink-3">of {fmtMin(target)} toward goals</span>
            </div>
            <Meter
              className="mt-2.5"
              height={6}
              legend={false}
              total={Math.max(target, planned, 1)}
              segments={[
                { kind: "done", value: effort, color: "var(--accent)" },
                {
                  kind: "planned",
                  value: Math.max(0, planned - effort),
                  color: "color-mix(in oklab, var(--accent) 32%, var(--surface))",
                },
              ]}
            />
            {facts.length > 0 && <p className="tnum mt-2 text-[13px] text-ink-3">{facts.join(", ")}</p>}
          </div>
        )}
        <div className="flex min-h-[64px] items-center gap-3 py-3 pr-3 pl-4">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">
              Week {weekNo} review
            </div>
            <div className="tnum truncate text-[13px] text-ink-3">
              {reviewed
                ? "Done. You can still change it."
                : daysLeft <= 2
                  ? "Five minutes, one check per goal"
                  : "Five minutes, best at the weekend"}
            </div>
          </div>
          <ButtonLink href="/app/review/week" variant={reviewed ? "outline" : "accent"} size="sm" className="px-4">
            {reviewed ? "Open" : "Start"}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

const STATUS_WORD = { on_track: "On track", adjust: "Drifting", off_track: "Off track" } as const;

function GoalRow({ h, today }: { h: GoalHealth; today: string }) {
  const { goal, week } = h;
  const effort = Math.max(week.doneMin, week.focusMin);
  const drifting = h.autoStatus !== "on_track";
  const ms = h.nextMilestone;
  const overdue = ms?.dueDate != null && ms.dueDate < today;
  const detail = drifting
    ? h.reasons[0]
    : ms
      ? `Next: ${ms.title}${ms.dueDate ? `, ${formatMonthDay(ms.dueDate)}` : ""}`
      : `${fmtMin(week.plannedMin)} blocked`;

  return (
    <Link href={`/app/goals/${goal.id}`} className="tap-row block px-4 py-3.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line" style={tint(goal.color)}>
      <div className="flex items-center gap-3">
        <span className="size-2.5 shrink-0 rounded-full bg-tint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium tracking-tight text-ink">{goal.title}</span>
        <span className="tnum shrink-0 text-[13px] text-ink-3">
          <span className="font-medium text-ink">{fmtMin(effort)}</span> / {fmtMin(week.targetMin)}
        </span>
        <ChevronRight className="-mr-1 size-4 shrink-0 text-ink-3" />
      </div>
      <div className="pl-[22px]">
        <LinearProgress className="mt-2.5" value={week.targetMin > 0 ? effort / week.targetMin : 0} color="var(--tint)" height={4} />
        <p className="mt-2 truncate text-[13px] text-ink-3">
          <span className={cn("font-medium", drifting || overdue ? "text-warn" : "text-ok")}>
            {overdue && !drifting ? "Milestone overdue" : STATUS_WORD[h.autoStatus]}
          </span>
          {detail && <>. {detail}</>}
        </p>
      </div>
    </Link>
  );
}
