import { and, desc, eq } from "drizzle-orm";
import { Settings } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Row, Section, Skeleton, Stat } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { addDays, formatDuration, formatMonthDay, startOfWeek, weekday } from "@/lib/dates";
import { getActiveSeason } from "@/lib/queries";
import { EnergyBars, EnergyLegend, FocusWeekChart } from "./charts";
import { DailyReflection } from "./daily-reflection";
import { getEnergyReport, getPastReviews, getReflectionStreak, getWeekStats } from "./data";
import { seasonWeek, StatusDots, weekLabel } from "./shared";

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
    <div>
      <div className="pt-6 pb-5 lg:pt-10">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-40" />
      </div>
      <Skeleton className="h-64 rounded-[22px]" />
      <Skeleton className="mt-4 h-20 rounded-[22px]" />
      <Skeleton className="mt-8 h-56 rounded-[22px]" />
    </div>
  );
}

function SettingsLink() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="tap grid size-11 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-soft"
    >
      <Settings className="size-[19px]" strokeWidth={1.9} />
    </Link>
  );
}

async function ReviewContent() {
  const user = await requireUser();
  const today = user.today;
  const weekStart = startOfWeek(today);
  const season = await getActiveSeason(user.id);
  const energyFrom = addDays(today, -27);

  const [daily, week, energy, streak, past, thisWeekly, lastWeekly] = await Promise.all([
    db
      .select()
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "daily"), eq(t.reflections.date, today)))
      .get(),
    getWeekStats(user.id, weekStart),
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
  ]);

  const weekNo = seasonWeek(weekStart, season);
  const weekTitle = weekNo ? `Week ${weekNo}` : `Week of ${formatMonthDay(weekStart)}`;
  const daysLeftInWeek = 6 - weekday(today);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={season ? `${weekTitle} · ${season.name}` : formatMonthDay(today)}
        title="Review"
        action={<SettingsLink />}
      />

      <DailyReflection key={daily?.id ?? "new"} today={today} saved={daily ?? null} />

      <Card className="mt-4 flex items-center gap-4 p-4 pl-5">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold tracking-tight text-ink">
            {weekTitle} review <span className="font-normal text-ink-3">· 5 min</span>
          </div>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {thisWeekly
              ? "Done. You can still change it."
              : daysLeftInWeek <= 2
                ? "Each goal, one honest check."
                : `Best on the weekend · ${daysLeftInWeek} days left`}
          </p>
        </div>
        <ButtonLink href="/review/week" variant={thisWeekly ? "secondary" : "primary"} size="sm" className="px-4">
          {thisWeekly ? "Open" : "Start"}
        </ButtonLink>
      </Card>

      <Section title="This week" action={`${formatMonthDay(weekStart)} – ${formatMonthDay(addDays(weekStart, 6))}`}>
        <Card className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Focus" value={formatDuration(week.focusMin)} />
            <Stat label="Sessions" value={week.sessions} />
            <Stat label="Quality" value={week.avgQuality ?? "–"} unit={week.avgQuality != null ? "/100" : undefined} />
          </div>
          <div className="mt-5">
            <FocusWeekChart days={week.days} today={today} />
          </div>
        </Card>
        <Card className="mt-3">
          <Row>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-ink">Blocks</span>
                <span className="tnum text-[13.5px] text-ink-3">
                  <span className="font-semibold text-ink">{week.blocks.done}</span> of {week.blocks.planned} done
                  {week.blocks.skipped > 0 && ` · ${week.blocks.skipped} skipped`}
                </span>
              </div>
              <SplitBar total={week.blocks.planned} done={week.blocks.done} skipped={week.blocks.skipped} />
            </div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-ink">Workouts</span>
                <span className="tnum text-[13.5px] text-ink-3">
                  <span className="font-semibold text-ink">{week.workouts.done}</span> of {week.workouts.scheduled}{" "}
                  scheduled
                </span>
              </div>
              <SplitBar total={Math.max(week.workouts.scheduled, week.workouts.done)} done={week.workouts.done} skipped={0} />
            </div>
          </Row>
        </Card>
      </Section>

      <Section title="Energy" action="Last 4 weeks">
        {energy.sessions === 0 && !lastWeekly ? (
          <EmptyState
            title="No energy data yet"
            body="After a focus session, rate how you feel. Patterns show up here."
          />
        ) : (
          <Card className="p-5">
            {energy.sessions > 0 && (
              <>
                <EnergyLegend />
                <div className="mt-4">
                  <div className="eyebrow mb-3">By goal</div>
                  <EnergyBars rows={energy.byGoal} />
                </div>
                {energy.byKind.length > 0 && (
                  <div className="mt-6">
                    <div className="eyebrow mb-3">By kind of work</div>
                    <EnergyBars rows={energy.byKind} />
                  </div>
                )}
              </>
            )}
            {lastWeekly && (
              <div className={cn("grid gap-3 sm:grid-cols-2", energy.sessions > 0 && "mt-6 border-t border-line pt-5")}>
                {lastWeekly.energisers && <EnergyNote label="Gave energy" text={lastWeekly.energisers} color="var(--c-teal)" />}
                {lastWeekly.drainers && <EnergyNote label="Drained" text={lastWeekly.drainers} color="var(--c-rose)" />}
              </div>
            )}
          </Card>
        )}
      </Section>

      <Section title="Check-in streak" action="Last 14 days">
        <Card className="flex items-center gap-5 px-5 py-4">
          <div className="flex shrink-0 items-baseline gap-1">
            <span className="display tnum text-[40px] text-ink">{streak.streak}</span>
            <span className="text-[13px] font-medium text-ink-3">{streak.streak === 1 ? "day" : "days"}</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
            {streak.last14.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  d.done ? "bg-accent" : "bg-sunken",
                  d.date === today && !d.done && "ring-1 ring-line-strong ring-inset",
                )}
              />
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Past reviews">
        {past.length === 0 ? (
          <EmptyState title="No weekly reviews yet" body="Your first one builds each goal's trajectory." />
        ) : (
          <Card>
            {past.map((r) => (
              <Row key={r.id} href={`/review/week?week=${r.date}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-ink">{weekLabel(r.date, season)}</div>
                  {r.wins && <div className="mt-0.5 truncate text-[13px] text-ink-3">{r.wins}</div>}
                </div>
                <StatusDots updates={r.updates} />
              </Row>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}

function SplitBar({ total, done, skipped }: { total: number; done: number; skipped: number }) {
  if (total === 0) return <div className="mt-2.5 h-1.5 rounded-full bg-sunken" />;
  return (
    <div className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-sunken">
      {done > 0 && <span className="h-full rounded-full bg-ink-2" style={{ width: `${(done / total) * 100}%` }} />}
      {skipped > 0 && <span className="h-full rounded-full bg-ink-3/40" style={{ width: `${(skipped / total) * 100}%` }} />}
    </div>
  );
}

function EnergyNote({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <p className="mt-1 text-[14.5px] leading-snug text-ink">{text}</p>
    </div>
  );
}
