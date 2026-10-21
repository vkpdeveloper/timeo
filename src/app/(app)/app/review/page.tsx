import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
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
  SubHeader,
} from "@/components/ui/primitives";
import { db, t } from "@/db";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { getGoalHealth, type GoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { addDays, formatMonthDay, startOfWeek, weekday } from "@/lib/dates";
import { getActiveSeason } from "@/lib/queries";
import { EnergyBars, EnergyLegend, FocusWeekChart } from "./charts";
import { DailyReflection } from "./daily-reflection";
import { getEnergyReport, getPastReviews, getReflectionStreak, getWeekStats, type WeekStats } from "./data";
import { roundedTime, seasonWeek, StatusDots, weekLabel } from "./shared";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewSkeleton() {
  return (
    <>
      <SubHeader back="/app/goals" backLabel="Season" />
      <div className="pt-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-5 h-12" />
        <Skeleton className="mt-6 h-[300px] rounded-[16px]" />
        <Skeleton className="mt-6 h-[220px] rounded-[16px]" />
      </div>
    </>
  );
}

const h = roundedTime;

/** One or two plain sentences: time protected so far, then which goal slipped. */
function weekSummary(week: WeekStats, health: GoalHealth[], isOver: boolean) {
  const { dueMin, doneMin } = week.blocks;
  let first: string;
  if (dueMin > 0) first = `You protected ${h(doneMin)} of ${h(dueMin)} planned${isOver ? "" : " so far"}.`;
  else if (week.focusMin > 0) first = `${h(week.focusMin)} of focus so far.`;
  else first = "Nothing planned yet this week.";

  const rank = { off_track: 0, adjust: 1, on_track: 2 } as const;
  const slipping = health.filter((g) => g.autoStatus !== "on_track").sort((a, b) => rank[a.autoStatus] - rank[b.autoStatus]);
  let second = "";
  if (slipping.length === 1) second = ` ${slipping[0].goal.title} slipped.`;
  else if (slipping.length > 1) second = ` ${slipping[0].goal.title} and ${slipping.length - 1} more slipped.`;
  else if (health.length > 0) second = " Every goal is on track.";
  return first + second;
}

async function ReviewContent() {
  const user = await requireUser();
  const today = user.today;
  const weekStart = startOfWeek(today);
  const season = await getActiveSeason(user.id);
  const energyFrom = addDays(today, -27);

  const [daily, week, energy, streak, past, thisWeekly, lastWeekly, health] = await Promise.all([
    db
      .select()
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "daily"), eq(t.reflections.date, today)))
      .get(),
    getWeekStats(user.id, weekStart, today),
    getEnergyReport(user.id, energyFrom, today),
    getReflectionStreak(user.id, today),
    getPastReviews(user.id),
    db
      .select({ id: t.reflections.id })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "weekly"), eq(t.reflections.date, weekStart)))
      .get(),
    db
      .select({ date: t.reflections.date, energisers: t.reflections.energisers, drainers: t.reflections.drainers })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "weekly")))
      .orderBy(desc(t.reflections.date))
      .limit(8)
      .then((rows) => rows.find((r) => r.energisers || r.drainers)),
    getGoalHealth(user.id, today),
  ]);

  const weekNo = seasonWeek(weekStart, season);
  const weekTitle = weekNo ? `Week ${weekNo}` : "This week";
  const range = `${formatMonthDay(weekStart)} – ${formatMonthDay(addDays(weekStart, 6))}`;
  const daysLeftInWeek = 6 - weekday(today);
  // From Friday on (or once started) the weekly review leads; before that, tonight's check-in does.
  const weeklyLeads = !thisWeekly && daysLeftInWeek <= 2;
  const workoutsTotal = Math.max(week.workouts.scheduled, week.workouts.done);

  const weekCard = (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            {weekTitle} review
          </div>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {thisWeekly
              ? "Done. You can still change it."
              : weeklyLeads
                ? "Five minutes, one check per goal."
                : `Five minutes, best at the weekend. ${daysLeftInWeek} ${daysLeftInWeek === 1 ? "day" : "days"} left.`}
          </p>
        </div>
        <ButtonLink href="/app/review/week" variant={weeklyLeads ? "accent" : "outline"} size="sm" className="px-4">
          {thisWeekly ? "Open" : "Start"}
        </ButtonLink>
      </div>
      {weeklyLeads && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <span className="text-[13px] text-ink-3">Short on time?</span>
          <AskTimi prompt={GUIDE.reviewWeek} label="Ask Timi for a read" className="ml-auto" />
        </div>
      )}
    </Card>
  );

  const tonight = (
    <Section title="Tonight">
      <DailyReflection key={daily?.id ?? "new"} today={today} saved={daily ?? null} primary={!weeklyLeads} />
    </Section>
  );

  return (
    <div className="page-enter">
      <SubHeader back="/app/goals" backLabel="Season" />
      <PageHeader
        className="pt-3 lg:pt-6"
        eyebrow={season ? `${weekTitle}, ${range}` : range}
        title="Review"
        subtitle={weekSummary(week, health, daysLeftInWeek === 0)}
      />

      <StatStrip>
        <Stat value={<CountUp value={week.focusMin} format="duration" />} label="focus this week" />
        <Stat
          value={`${week.blocks.done}`}
          unit={`of ${week.blocks.planned}`}
          label="blocks done"
        />
        <Stat value={streak.streak} unit={streak.streak === 1 ? "day" : "days"} label="check-in streak" />
      </StatStrip>

      {weeklyLeads ? (
        <>
          <div className="mt-5">{weekCard}</div>
          {tonight}
        </>
      ) : (
        <>
          <div className="mt-5">{tonight}</div>
          <div className="mt-3">{weekCard}</div>
        </>
      )}

      <Section title="This week" card>
        <div className="px-4 pt-4 pb-3">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-ink-2">Focus by day</span>
            <span className="tnum text-[12.5px] text-ink-3">
              {week.sessions} {week.sessions === 1 ? "session" : "sessions"}
              {week.avgQuality != null && `, quality ${week.avgQuality}`}
            </span>
          </div>
          <FocusWeekChart days={week.days} today={today} />
        </div>
        <ProgressRow
          label="Blocks"
          value={
            <>
              <span className="font-semibold text-ink">{week.blocks.done}</span> of {week.blocks.planned} done
              {week.blocks.skipped > 0 && `, ${week.blocks.skipped} skipped`}
            </>
          }
          total={week.blocks.planned}
          done={week.blocks.done}
          missed={week.blocks.skipped}
        />
        <ProgressRow
          label="Workouts"
          value={
            <>
              <span className="font-semibold text-ink">{week.workouts.done}</span> of {week.workouts.scheduled} scheduled
            </>
          }
          total={workoutsTotal}
          done={week.workouts.done}
          missed={0}
        />
      </Section>

      <Section title="Energy" count="last 4 weeks">
        {energy.sessions === 0 && !lastWeekly ? (
          <EmptyState title="No energy data yet" body="After a focus session, rate how you feel. Patterns show up here." />
        ) : (
          <Card className="p-4">
            {energy.sessions > 0 && (
              <>
                <EnergyLegend />
                <div className="mt-3">
                  <div className="eyebrow mb-2.5">By goal</div>
                  <EnergyBars rows={energy.byGoal} />
                </div>
                {energy.byKind.length > 0 && (
                  <div className="mt-5">
                    <div className="eyebrow mb-2.5">By kind of work</div>
                    <EnergyBars rows={energy.byKind} />
                  </div>
                )}
              </>
            )}
            {lastWeekly && (
              <div className={cn("grid gap-2 sm:grid-cols-2", energy.sessions > 0 && "mt-5 border-t border-line pt-4")}>
                {lastWeekly.energisers && <EnergyNote label="Gave energy" text={lastWeekly.energisers} color="var(--accent)" />}
                {lastWeekly.drainers && <EnergyNote label="Drained" text={lastWeekly.drainers} color="var(--warn)" />}
              </div>
            )}
          </Card>
        )}
      </Section>

      <Section title="Past reviews" card={past.length > 0}>
        {past.length === 0 ? (
          <EmptyState title="No weekly reviews yet" body="Your first one starts each goal's trend." />
        ) : (
          past.map((r) => (
            <Row
              key={r.id}
              href={`/app/review/week?week=${r.date}`}
              title={weekLabel(r.date, season)}
              subtitle={r.wins ?? undefined}
            >
              <StatusDots updates={r.updates} className="ml-auto" />
            </Row>
          ))
        )}
      </Section>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  done,
  missed,
}: {
  label: string;
  value: React.ReactNode;
  total: number;
  done: number;
  missed: number;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-medium text-ink">{label}</span>
        <span className="tnum text-[13px] text-ink-3">{value}</span>
      </div>
      <Meter
        className="mt-2"
        height={6}
        legend={false}
        total={Math.max(total, 1)}
        segments={[
          { value: done, color: "var(--ink-2)" },
          { value: missed, color: "color-mix(in oklab, var(--bad) 55%, var(--surface))" },
        ]}
      />
    </div>
  );
}

function EnergyNote({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className="py-1">
      <div className="text-[12.5px] font-medium" style={{ color }}>
        {label}
      </div>
      <p className="mt-0.5 text-[14.5px] leading-snug text-ink">{text}</p>
    </div>
  );
}
