import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, Chip, Section, Skeleton, StatusPill, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getGoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { tint } from "@/lib/colors";
import { formatMonthDay, relativeDay, startOfWeek, todayIn } from "@/lib/dates";
import { getGoalOptions } from "@/lib/queries";
import { areaLabel, fmtHours, fmtMin, TIERS } from "../_components/meta";
import { CheckInButton, CoachAction, GoalMenu, MilestoneList, TaskList } from "./goal-client";

export default function GoalPage(props: PageProps<"/goals/[id]">) {
  return (
    <Suspense fallback={<GoalSkeleton />}>
      <GoalContent params={props.params} />
    </Suspense>
  );
}

function GoalSkeleton() {
  return (
    <>
      <SubHeader back="/goals" backLabel="Goals" />
      <div className="pt-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-64" />
        <Skeleton className="mt-6 h-32" />
        <Skeleton className="mt-8 h-40" />
      </div>
    </>
  );
}

async function GoalContent({ params }: { params: PageProps<"/goals/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const goal = await db
    .select()
    .from(t.goals)
    .where(and(eq(t.goals.id, id), eq(t.goals.userId, user.id)))
    .get();
  if (!goal) notFound();

  const weekStart = startOfWeek(user.today);
  const [season, milestones, updates, tasks, healthAll, goalOptions] = await Promise.all([
    db.select().from(t.seasons).where(eq(t.seasons.id, goal.seasonId)).get(),
    db.select().from(t.milestones).where(eq(t.milestones.goalId, goal.id)).orderBy(asc(t.milestones.sortOrder)),
    db.select().from(t.goalUpdates).where(eq(t.goalUpdates.goalId, goal.id)).orderBy(desc(t.goalUpdates.date), desc(t.goalUpdates.createdAt)),
    db
      .select()
      .from(t.tasks)
      .where(and(eq(t.tasks.goalId, goal.id), eq(t.tasks.userId, user.id), or(isNull(t.tasks.doneAt), eq(t.tasks.weekStart, weekStart))))
      .orderBy(asc(t.tasks.sortOrder), asc(t.tasks.createdAt)),
    getGoalHealth(user.id, user.today),
    getGoalOptions(user.id),
  ]);
  const health = healthAll.find((h) => h.goal.id === goal.id);
  const ctx = { goals: goalOptions, today: user.today };
  const endLabel = season ? formatMonthDay(season.endDate) : "the end of the season";

  const steps = tasks.filter((x) => x.weekStart === weekStart);
  const otherTasks = tasks.filter((x) => x.weekStart !== weekStart && x.doneAt == null);
  const sortedMilestones = [...milestones].sort(
    (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.sortOrder - b.sortOrder,
  );
  const done = goal.completedAt != null;
  const tier = TIERS.find((x) => x.value === goal.tier);

  return (
    <div style={tint(goal.color)}>
      <SubHeader back="/goals" backLabel="Goals" action={<GoalMenu goal={goal} endDateLabel={endLabel} />} />

      {/* Hero */}
      <header className="pt-5 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="bg-tint-soft text-ink">
            <span className="size-2 rounded-full bg-tint" />
            {tier?.heading}
          </Chip>
          <Chip>{areaLabel(goal.area)}</Chip>
          <Chip className="tnum">{fmtHours(goal.weeklyHours)} / week</Chip>
        </div>
        <h1 className={cn("display mt-4 text-[38px] text-ink", done && "text-ink-3 line-through decoration-line-strong")}>{goal.title}</h1>
        {goal.outcome && <p className="mt-2.5 text-[16.5px] leading-relaxed text-ink-2">{goal.outcome}</p>}

        {done ? (
          <p className="mt-4 inline-flex rounded-full bg-ok-soft px-3 py-1.5 text-[13px] font-semibold text-ok">
            Completed {goal.completedAt ? formatMonthDay(todayIn(user.timezone, new Date(goal.completedAt))) : ""}
          </p>
        ) : (
          health && (
            <div className="mt-4">
              <StatusPill status={health.autoStatus} />
              <ul className="mt-2.5 flex flex-col gap-1 px-0.5">
                {health.reasons.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-[14px] text-ink-2">
                    <span className="size-1 shrink-0 rounded-full bg-ink-3" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </header>

      {(goal.why || goal.system) && (
        <Card className="mt-5 overflow-hidden">
          {goal.why && <InfoRow label="Why">{goal.why}</InfoRow>}
          {goal.system && <InfoRow label="System">{goal.system}</InfoRow>}
        </Card>
      )}

      {health && !done && (
        <Section title="This week" action={<span className="tnum">target {fmtHours(goal.weeklyHours)}</span>} className="mt-8">
          <Card className="p-4">
            <div className="grid grid-cols-4 gap-2">
              <Metric label="Planned" value={fmtMin(health.week.plannedMin)} />
              <Metric label="Done" value={fmtMin(health.week.doneMin)} />
              <Metric label="Focus" value={fmtMin(health.week.focusMin)} />
              <Metric label="Moved" value={`${health.week.rescheduleCount}×`} warn={health.week.rescheduleCount >= 3} />
            </div>
            <WeekBar planned={health.week.plannedMin} done={Math.max(health.week.doneMin, health.week.focusMin)} target={health.week.targetMin} />
            {health.recommendation && (
              <div className="mt-4">
                <CoachAction rec={health.recommendation} ctx={ctx} goalTitle={goal.title} />
              </div>
            )}
          </Card>
        </Section>
      )}

      <Section
        title="Weekly steps"
        action={steps.length > 0 && <span className="tnum">{steps.filter((s) => s.doneAt != null).length} of {steps.length} done</span>}
        className="mt-8"
      >
        <TaskList tasks={steps} ctx={ctx} goalId={goal.id} weekly empty="What's the smallest next action this week?" />
      </Section>

      <Section
        title="Milestones"
        action={milestones.length > 0 && <span className="tnum">{milestones.filter((m) => m.doneAt != null).length} of {milestones.length}</span>}
        className="mt-8"
      >
        <MilestoneList milestones={sortedMilestones} goalId={goal.id} today={user.today} />
      </Section>

      {otherTasks.length > 0 && (
        <Section title="Other open tasks" className="mt-8">
          <TaskList tasks={otherTasks} ctx={ctx} goalId={goal.id} />
        </Section>
      )}

      <Section title="Trajectory" action={!done && <CheckInButton goalId={goal.id} suggested={health?.autoStatus ?? goal.status} />} className="mt-8">
        {updates.length === 0 ? (
          <Card className="px-4 py-5 text-[14px] text-ink-3">No check-ins yet. A quick weekly read builds the trend line.</Card>
        ) : (
          <Card className="px-4 py-2">
            <ol>
              {updates.map((u, i) => (
                <li key={u.id} className="relative flex gap-3.5 py-3">
                  <div className="relative flex w-3 shrink-0 justify-center">
                    <span
                      className={cn(
                        "relative z-10 mt-[7px] size-2.5 rounded-full ring-4 ring-surface",
                        u.status === "on_track" ? "bg-ok" : u.status === "adjust" ? "bg-warn" : "bg-bad",
                      )}
                    />
                    {i < updates.length - 1 && <span className="absolute top-[14px] -bottom-6 w-px bg-line-strong" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={u.status} />
                      <span className="tnum text-[12.5px] text-ink-3">
                        {u.confidence != null && <span className="font-medium text-ink-2">{u.confidence}% · </span>}
                        {relativeDay(u.date, user.today)}
                      </span>
                    </div>
                    {u.note && <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{u.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </Section>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <div className="w-14 shrink-0 pt-px text-[13px] font-medium text-ink-3">{label}</div>
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className={cn("tnum mt-0.5 text-[19px] font-semibold tracking-tight", warn ? "text-bad" : "text-ink")}>{value}</div>
    </div>
  );
}

function WeekBar({ planned, done, target }: { planned: number; done: number; target: number }) {
  const max = Math.max(target, planned, 1);
  return (
    <div className="mt-4">
      <div className="relative h-2 overflow-hidden rounded-full bg-sunken">
        <div className="absolute inset-y-0 left-0 rounded-full bg-tint opacity-30" style={{ width: `${(planned / max) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-tint" style={{ width: `${(Math.min(done, max) / max) * 100}%` }} />
        {target > 0 && target < max && <div className="absolute inset-y-0 w-0.5 bg-ink-3" style={{ left: `${(target / max) * 100}%` }} />}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-tint" /> Done
          <span className="ml-2 size-2 rounded-full bg-tint opacity-30" /> Planned
        </span>
        <span className="tnum">{fmtMin(target)} target</span>
      </div>
    </div>
  );
}
