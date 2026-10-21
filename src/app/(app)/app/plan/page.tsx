import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { addDays, isValidISODate, nowMinIn, startOfWeek, weekDays, weekday } from "@/lib/dates";
import { getActiveSeason, getGoalOptions } from "@/lib/queries";
import { coveredMinutes, findFreeSlot } from "@/lib/schedule";
import { dayBounds, dayCapacity } from "../today-headline";
import type { Capacity, DayLoad } from "./_components/capacity";
import { LightWeekHint } from "./_components/capacity";
import { DayView } from "./_components/day-view";
import { PlanHeader } from "./_components/plan-header";
import { PlanProvider } from "./_components/plan-provider";
import type { Ghost, GoalInfo, PlanBlock, PlanView, UnscheduledTask } from "./_components/types";
import { UnscheduledTray } from "./_components/unscheduled-tray";
import { ViewSwitch } from "./_components/view-switch";
import { WeekSummary, WeekView } from "./_components/week-view";

export const metadata: Metadata = { title: "Week" };

export default function PlanPage(props: PageProps<"/app/plan">) {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <PlanContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function PlanSkeleton() {
  return (
    <div className="pt-5 lg:pt-10">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="mt-3 h-8 w-full" />
      <Skeleton className="mt-4 h-[60dvh] w-full" />
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function PlanContent({ searchParams }: { searchParams: PageProps<"/app/plan">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const rawDate = one(sp.date);
  const date = isValidISODate(rawDate) ? rawDate : user.today;
  const view: PlanView = one(sp.view) === "week" ? "week" : "day";
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const days = weekDays(weekStart);

  const [blockRows, goalRows, goalOptions, season, scheduleRows, workoutLogRows, taskRows] = await Promise.all([
    db
      .select()
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, user.id), gte(t.blocks.date, weekStart), lte(t.blocks.date, weekEnd)))
      .orderBy(asc(t.blocks.date), asc(t.blocks.startMin)),
    db
      .select({
        id: t.goals.id,
        title: t.goals.title,
        color: t.goals.color,
        weeklyHours: t.goals.weeklyHours,
        seasonId: t.goals.seasonId,
        completedAt: t.goals.completedAt,
        sortOrder: t.goals.sortOrder,
        tier: t.goals.tier,
      })
      .from(t.goals)
      .where(eq(t.goals.userId, user.id))
      .orderBy(asc(t.goals.sortOrder), asc(t.goals.createdAt)),
    getGoalOptions(user.id),
    getActiveSeason(user.id),
    db
      .select({
        weekday: t.gymSchedule.weekday,
        startMin: t.gymSchedule.startMin,
        durationMin: t.gymSchedule.durationMin,
        name: t.workoutTemplates.name,
        color: t.workoutTemplates.color,
      })
      .from(t.gymSchedule)
      .innerJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
      .where(eq(t.gymSchedule.userId, user.id)),
    db
      .select({ date: t.workoutLogs.date })
      .from(t.workoutLogs)
      .where(and(eq(t.workoutLogs.userId, user.id), gte(t.workoutLogs.date, weekStart), lte(t.workoutLogs.date, weekEnd))),
    db
      .select({
        id: t.tasks.id,
        title: t.tasks.title,
        goalId: t.tasks.goalId,
        dueDate: t.tasks.dueDate,
        estimateMin: t.tasks.estimateMin,
      })
      .from(t.tasks)
      .where(
        and(
          eq(t.tasks.userId, user.id),
          isNull(t.tasks.doneAt),
          date === user.today ? lte(t.tasks.dueDate, date) : eq(t.tasks.dueDate, date),
        ),
      )
      .orderBy(asc(t.tasks.dueDate), asc(t.tasks.sortOrder), asc(t.tasks.createdAt)),
  ]);

  // ── Goals and colours ──
  const goalById = new Map(goalRows.map((g) => [g.id, g]));
  const goals: GoalInfo[] = goalRows.map((g) => ({
    id: g.id,
    title: g.title,
    color: g.color,
  }));
  const scheduleByWeekday = new Map(scheduleRows.map((s) => [s.weekday, s]));
  const routineColor = new Map(scheduleRows.map((s) => [s.name, s.color]));

  const blocks: PlanBlock[] = blockRows.map((b) => {
    const g = b.goalId ? goalById.get(b.goalId) : undefined;
    return {
      ...b,
      color: g?.color ?? (b.kind === "workout" ? (routineColor.get(b.title) ?? null) : null),
      goalTitle: g?.title ?? null,
    };
  });

  // ── Gym split ghosts: a routine is scheduled, nothing on the calendar, nothing logged ──
  const loggedDays = new Set(workoutLogRows.map((w) => w.date));
  const ghosts: Ghost[] = days.flatMap((d) => {
    const s = scheduleByWeekday.get(weekday(d));
    if (!s || loggedDays.has(d) || d < user.today) return [];
    if (blocks.some((b) => b.date === d && b.kind === "workout")) return [];
    return [
      {
        date: d,
        name: s.name,
        color: s.color,
        startMin: s.startMin,
        durationMin: s.durationMin,
      },
    ];
  });

  // ── Unscheduled tasks for the selected day ──
  const taskIds = taskRows.map((r) => r.id);
  const scheduledTaskIds = new Set(
    taskIds.length
      ? (
          await db
            .select({ taskId: t.blocks.taskId })
            .from(t.blocks)
            .where(
              and(
                eq(t.blocks.userId, user.id),
                inArray(t.blocks.taskId, taskIds),
                // a missed block in the past no longer counts as scheduled
                isNull(t.blocks.skippedAt),
                gte(t.blocks.date, date),
              ),
            )
        ).map((r) => r.taskId)
      : [],
  );
  const dayBlocks = blocks.filter((b) => b.date === date && !b.skippedAt);
  const busy = dayBlocks.map((b) => ({
    startMin: b.startMin,
    endMin: b.endMin,
  }));
  const dayGhost = ghosts.find((g) => g.date === date) ?? null;
  if (dayGhost?.startMin != null)
    busy.push({
      startMin: dayGhost.startMin,
      endMin: dayGhost.startMin + dayGhost.durationMin,
    });
  const nowRounded = date === user.today ? Math.ceil(nowMinIn(user.timezone) / 15) * 15 : 0;
  // mornings first, but not before 8am unless the day itself starts later
  const slotStart = Math.max(user.dayStartMin, 8 * 60, nowRounded);
  const unscheduled: UnscheduledTask[] = [];
  for (const task of taskRows) {
    if (scheduledTaskIds.has(task.id)) continue;
    const minutes = Math.min(240, Math.max(15, task.estimateMin ?? 60));
    const slot = findFreeSlot(busy, minutes, slotStart, user.dayEndMin);
    // reserve the slot so the next task gets the following gap
    if (slot) busy.push({ startMin: slot.start, endMin: slot.end });
    unscheduled.push({
      ...task,
      overdue: !!task.dueDate && task.dueDate < user.today,
      slot,
    });
  }

  // ── Week summary: planned hours per goal vs target ──
  const seasonGoals = season ? goalRows.filter((g) => g.seasonId === season.id && !g.completedAt) : [];
  const plannedByGoal = new Map<string, number>();
  for (const b of blocks) {
    if (!b.goalId || b.skippedAt) continue;
    plannedByGoal.set(b.goalId, (plannedByGoal.get(b.goalId) ?? 0) + (b.endMin - b.startMin));
  }
  const summary = seasonGoals.map((g) => ({
    id: g.id,
    title: g.title,
    color: g.color,
    targetMin: Math.round(g.weeklyHours * 60),
    plannedMin: plannedByGoal.get(g.id) ?? 0,
  }));

  // ── Capacity: done / still planned / free, per day and for the week ──
  const nowMin = nowMinIn(user.timezone);
  const capacityOf = (d: string): Capacity => {
    const list = blocks.filter((b) => b.date === d);
    const live = list.filter((b) => !b.skippedAt);
    const bounds = dayBounds(user.dayStartMin, user.dayEndMin, live);
    const plannedTotal = coveredMinutes(live);
    // past days have no free time left; today counts from now
    if (d < user.today) {
      const doneMin = coveredMinutes(live.filter((b) => b.doneAt));
      return {
        plannedTotal,
        doneMin,
        plannedMin: plannedTotal - doneMin,
        freeMin: 0,
        past: true,
        done: live.filter((b) => b.doneAt).length,
        count: live.length,
      };
    }
    const cap = dayCapacity({
      blocks: list,
      nowMin: d === user.today ? nowMin : 0,
      bounds,
    });
    return {
      plannedTotal,
      ...cap,
      past: false,
      done: live.filter((b) => b.doneAt).length,
      count: live.length,
    };
  };
  const dayCaps = new Map(days.map((d) => [d, capacityOf(d)]));
  const weekCap: Capacity = [...dayCaps.values()].reduce(
    (a, c) => ({
      plannedTotal: a.plannedTotal + c.plannedTotal,
      doneMin: a.doneMin + c.doneMin,
      plannedMin: a.plannedMin + c.plannedMin,
      freeMin: a.freeMin + c.freeMin,
      past: a.past && c.past,
      done: a.done + c.done,
      count: a.count + c.count,
    }),
    {
      plannedTotal: 0,
      doneMin: 0,
      plannedMin: 0,
      freeMin: 0,
      past: true,
      done: 0,
      count: 0,
    },
  );
  // a light week (still ahead): goal time well short of the targets, or little planned at all
  const goalTarget = summary.reduce((s, g) => s + g.targetMin, 0);
  const goalPlanned = summary.reduce((s, g) => s + g.plannedMin, 0);
  const lightWeek = weekEnd >= user.today && (goalTarget > 0 ? goalPlanned < goalTarget * 0.75 : weekCap.plannedTotal < 10 * 60);

  // load per day: planned minutes by colour against the length of the day
  const loadOf = (d: string): DayLoad => {
    const live = blocks.filter((b) => b.date === d && !b.skippedAt);
    const bounds = dayBounds(user.dayStartMin, user.dayEndMin, live);
    const byColor = new Map<string, number>();
    for (const b of live) {
      const key = b.color ?? "";
      byColor.set(key, (byColor.get(key) ?? 0) + (b.endMin - b.startMin));
    }
    const total = live.reduce((s, b) => s + (b.endMin - b.startMin), 0);
    const planned = dayCaps.get(d)?.plannedTotal ?? 0;
    // overlapping blocks: scale the parts so they add up to the covered time
    const k = total > 0 ? planned / total : 0;
    return {
      span: Math.max(60, bounds.end - bounds.start),
      parts: [...byColor.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([color, min]) => ({ color: color || null, min: min * k })),
    };
  };

  // Visible hour range for the timeline: the user's day, stretched to fit any blocks.
  const span = (list: { startMin: number; endMin: number }[]) => {
    let lo = user.dayStartMin;
    let hi = user.dayEndMin;
    for (const s of list) {
      lo = Math.min(lo, s.startMin);
      hi = Math.max(hi, s.endMin);
    }
    return {
      start: Math.max(0, Math.floor(lo / 60) * 60),
      end: Math.min(24 * 60, Math.ceil(hi / 60) * 60),
    };
  };
  const ghostSpans = (list: Ghost[]) =>
    list.flatMap((g) => (g.startMin != null ? [{ startMin: g.startMin, endMin: g.startMin + g.durationMin }] : []));

  const seasonInfo = season ? { startDate: season.startDate, endDate: season.endDate } : null;

  return (
    <PlanProvider goals={goalOptions} today={user.today}>
      <PlanHeader
        date={date}
        today={user.today}
        view={view}
        season={seasonInfo}
        loads={Object.fromEntries(days.map((d) => [d, loadOf(d)]))}
        caps={Object.fromEntries(dayCaps)}
        weekCap={weekCap}
      />
      {lightWeek && <LightWeekHint className="mt-3" goalPlanned={goalPlanned} goalTarget={goalTarget} />}
      <ViewSwitch id={view === "day" ? date : `week:${weekStart}`} order={view === "day" ? date : weekStart}>
        {view === "day" ? (
          <>
            <UnscheduledTray date={date} tasks={unscheduled} goals={goals} />
            <DayView
              date={date}
              today={user.today}
              timezone={user.timezone}
              range={span([...blocks.filter((b) => b.date === date), ...ghostSpans(dayGhost ? [dayGhost] : [])])}
              blocks={blocks.filter((b) => b.date === date)}
              ghost={dayGhost}
            />
          </>
        ) : (
          <>
            <WeekView
              days={days}
              today={user.today}
              timezone={user.timezone}
              range={span([...blocks, ...ghostSpans(ghosts)])}
              blocks={blocks}
              ghosts={ghosts}
              caps={Object.fromEntries(dayCaps)}
            />
            <WeekSummary goals={summary} />
          </>
        )}
      </ViewSwitch>
    </PlanProvider>
  );
}
