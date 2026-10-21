import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AskTimi, Card, Meter, Section, Skeleton, StatusPill, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { GUIDE } from "@/lib/ai/guide";
import { requireUser } from "@/lib/auth";
import { getGoalHealth, type GoalHealth } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { tint } from "@/lib/colors";
import { formatMonthDay, relativeDay, startOfWeek, todayIn } from "@/lib/dates";
import { getGoalOptions } from "@/lib/queries";
import { areaLabel, fmtHours, fmtMin, tierLabel } from "../_components/meta";
import { CheckInButton, CoachAction, GoalMenu, MilestoneList, TaskList } from "./goal-client";

export default function GoalPage(props: PageProps<"/app/goals/[id]">) {
  return (
    <Suspense fallback={<GoalSkeleton />}>
      <GoalContent params={props.params} />
    </Suspense>
  );
}

function GoalSkeleton() {
  return (
    <>
      <SubHeader back="/app/goals" backLabel="Season" />
      <div className="pt-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-56" />
        <Skeleton className="mt-5 h-40 rounded-[16px]" />
        <Skeleton className="mt-6 h-[104px] rounded-[16px]" />
        <Skeleton className="mt-6 h-[160px] rounded-[16px]" />
      </div>
    </>
  );
}

async function GoalContent({ params }: { params: PageProps<"/app/goals/[id]">["params"] }) {
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
    db.select().from(t.seasons).where(and(eq(t.seasons.id, goal.seasonId), eq(t.seasons.userId, user.id))).get(),
    db
      .select()
      .from(t.milestones)
      .where(and(eq(t.milestones.goalId, goal.id), eq(t.milestones.userId, user.id)))
      .orderBy(asc(t.milestones.sortOrder)),
    db
      .select()
      .from(t.goalUpdates)
      .where(and(eq(t.goalUpdates.goalId, goal.id), eq(t.goalUpdates.userId, user.id)))
      .orderBy(desc(t.goalUpdates.date), desc(t.goalUpdates.createdAt)),
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
  const drifting = health != null && health.autoStatus !== "on_track";

  return (
    <div style={tint(goal.color)}>
      <SubHeader back="/app/goals" backLabel="Season" action={<GoalMenu goal={goal} endDateLabel={endLabel} />} />

      {/* Hero: what it is, why it matters, how it's going */}
      <header className="page-enter pt-4 pb-5">
        <div className="eyebrow flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-tint" />
          {tierLabel(goal.tier)} · {areaLabel(goal.area)}
        </div>
        <h1 className={cn("display mt-1.5 text-[26px] text-balance text-ink lg:text-[28px]", done && "text-ink-3 line-through decoration-line-strong")}>
          {goal.title}
        </h1>
        {goal.why && <p className="mt-1.5 text-[14.5px] leading-snug text-ink-2">{goal.why}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {done ? (
            <span className="inline-flex rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-medium text-ok">
              Completed {goal.completedAt ? formatMonthDay(todayIn(user.timezone, new Date(goal.completedAt))) : ""}
            </span>
          ) : (
            health && (
              <>
                <StatusPill status={health.autoStatus} />
                {drifting && health.reasons[0] && <span className="text-[13px] text-ink-2">{health.reasons[0]}</span>}
              </>
            )
          )}
        </div>
      </header>

      {health && !done && <ThisWeek h={health} ctx={ctx} title={goal.title} drifting={drifting} />}

      {(goal.outcome || goal.system) && (
        <Section title="Goal and system" card>
          {goal.outcome && <InfoRow label="Goal">{goal.outcome}</InfoRow>}
          {goal.system && <InfoRow label="System">{goal.system}</InfoRow>}
          <InfoRow label="Time">
            <span className="tnum">{fmtHours(goal.weeklyHours)} a week</span>
          </InfoRow>
        </Section>
      )}

      <Section
        title="This week's steps"
        count={steps.length > 0 ? `${steps.filter((s) => s.doneAt != null).length} of ${steps.length}` : undefined}
      >
        <TaskList tasks={steps} ctx={ctx} goalId={goal.id} weekly empty="What's the smallest next action this week?" />
      </Section>

      <Section
        title="Milestones"
        count={milestones.length > 0 ? `${milestones.filter((m) => m.doneAt != null).length} of ${milestones.length}` : undefined}
        action={season && <span className="tnum">Season ends {endLabel}</span>}
      >
        <MilestoneList milestones={sortedMilestones} goalId={goal.id} today={user.today} />
      </Section>

      {otherTasks.length > 0 && (
        <Section title="Other open tasks" count={otherTasks.length}>
          <TaskList tasks={otherTasks} ctx={ctx} goalId={goal.id} />
        </Section>
      )}

      <Section title="Check-ins" count={updates.length || undefined} action={!done && <CheckInButton goalId={goal.id} suggested={health?.autoStatus ?? goal.status} />}>
        {updates.length === 0 ? (
          <Card className="px-4 py-4 text-[13.5px] text-ink-3">No check-ins yet. One honest read a week builds the trend.</Card>
        ) : (
          <Card className="px-4 py-1.5">
            <ol>
              {updates.map((u, i) => (
                <li key={u.id} className="relative flex gap-3.5 py-2.5">
                  <div className="relative flex w-3 shrink-0 justify-center">
                    <span
                      className={cn(
                        "relative z-10 mt-[9px] size-2.5 rounded-full ring-4 ring-surface",
                        u.status === "on_track" ? "bg-ok" : "bg-warn",
                      )}
                    />
                    {i < updates.length - 1 && <span className="absolute top-[16px] -bottom-[18px] w-px bg-line-strong" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={u.status} />
                      <span className="tnum text-[12.5px] text-ink-3">
                        {u.confidence != null && <span className="font-medium text-ink-2">{u.confidence}% · </span>}
                        {relativeDay(u.date, user.today)}
                      </span>
                    </div>
                    {u.note && <p className="mt-1 text-[14px] leading-snug text-ink-2">{u.note}</p>}
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

function ThisWeek({
  h,
  ctx,
  title,
  drifting,
}: {
  h: GoalHealth;
  ctx: Parameters<typeof CoachAction>[0]["ctx"];
  title: string;
  drifting: boolean;
}) {
  const w = h.week;
  const effort = Math.max(w.doneMin, w.focusMin);
  const moreBlocked = Math.max(0, w.plannedMin - effort);
  const unblocked = Math.max(0, w.targetMin - Math.max(w.plannedMin, effort));
  const facts = [
    w.focusMin > 0 ? `${fmtMin(w.focusMin)} focus` : null,
    w.stepsTotal > 0 ? `${w.stepsDone} of ${w.stepsTotal} ${w.stepsTotal === 1 ? "step" : "steps"}` : null,
    w.rescheduleCount > 0 ? `moved ${w.rescheduleCount}×` : null,
    w.skippedCount > 0 ? `${w.skippedCount} skipped` : null,
  ].filter(Boolean);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="tnum flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold tracking-tight text-ink">{fmtMin(effort)}</span>
          <span className="text-[13.5px] text-ink-3">of {fmtMin(w.targetMin)} this week</span>
        </div>
        <span className="tnum shrink-0 text-[13px] text-ink-3">{fmtMin(w.plannedMin)} blocked</span>
      </div>
      <Meter
        className="mt-3"
        total={Math.max(w.targetMin, w.plannedMin, effort, 1)}
        segments={[
          { kind: "done", value: effort, label: `${fmtMin(effort)} done` },
          { kind: "planned", value: moreBlocked, label: moreBlocked > 0 ? `${fmtMin(moreBlocked)} still blocked` : undefined },
          { kind: "free", value: unblocked, label: unblocked > 0 ? `${fmtMin(unblocked)} not blocked` : undefined },
        ]}
      />
      {facts.length > 0 && <p className="tnum mt-1.5 text-[12.5px] text-ink-3">{facts.join(" · ")}</p>}
      {(h.recommendation || drifting) && (
        <div className="mt-4 flex flex-col items-stretch gap-2.5">
          {h.recommendation && <CoachAction rec={h.recommendation} ctx={ctx} goalTitle={title} />}
          {drifting && <AskTimi prompt={GUIDE.rescueGoal(title)} label="Find a fix with Timi" className="self-center" />}
        </div>
      )}
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] gap-4 px-4 py-3">
      <div className="w-14 shrink-0 pt-px text-[13px] font-medium text-ink-3">{label}</div>
      <div className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{children}</div>
    </div>
  );
}
