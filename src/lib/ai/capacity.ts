import "server-only";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db, t } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { getGoalHealth } from "@/lib/coach";
import { addDays, diffDays, formatDuration, formatMin, nowMinIn, startOfWeek, WEEKDAY_SHORT } from "@/lib/dates";
import { getActiveSeason, getSeasonGoals, seasonProgress } from "@/lib/queries";
import { coveredMinutes } from "@/lib/schedule";

/*
 * Time math for "what can I get done?": free time inside the planner day
 * (blocks and the gym slot count as busy), what each goal asks for this week
 * against what is planned, and how much season is left. Deterministic, no AI.
 */

type Span = { startMin: number; endMin: number };

/** Free time is never all usable: meals, breaks and switching eat about a quarter. */
const USABLE = 0.75;
/** Gaps shorter than this don't count as a window you can plan into. */
const MIN_WINDOW = 30;

const q15 = (min: number) => Math.max(0, Math.floor(min / 15) * 15);
export const dur = (min: number) => (min <= 0 ? "0m" : formatDuration(q15(min) || min));

function freeIn(busy: Span[], from: number, to: number) {
  if (to <= from) return { freeMin: 0, windows: [] as string[] };
  const clipped = busy
    .map((b) => ({ startMin: Math.max(from, b.startMin), endMin: Math.min(to, b.endMin) }))
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const windows: string[] = [];
  let cursor = from;
  for (const b of clipped) {
    if (b.startMin - cursor >= MIN_WINDOW) windows.push(`${formatMin(cursor, true)}–${formatMin(b.startMin, true)}`);
    cursor = Math.max(cursor, b.endMin);
  }
  if (to - cursor >= MIN_WINDOW) windows.push(`${formatMin(cursor, true)}–${formatMin(to, true)}`);
  return { freeMin: to - from - coveredMinutes(clipped), windows };
}

export type Capacity = Awaited<ReturnType<typeof getCapacity>>;

/** Capacity for the week holding `date` (default this week). Past days are skipped; today counts from now. */
export async function getCapacity(user: CurrentUser, date = user.today) {
  const today = user.today;
  const ws = startOfWeek(date);
  const we = addDays(ws, 6);
  const thisWeek = ws === startOfWeek(today);
  const nowMin = nowMinIn(user.timezone);
  const dayStart = user.dayStartMin;
  const dayEnd = user.dayEndMin;

  const [blocks, gym, season, openToday] = await Promise.all([
    db
      .select({ date: t.blocks.date, start: t.blocks.startMin, end: t.blocks.endMin, kind: t.blocks.kind, goalId: t.blocks.goalId, done: t.blocks.doneAt, skipped: t.blocks.skippedAt })
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, user.id), gte(t.blocks.date, ws), lte(t.blocks.date, we))),
    db
      .select({ weekday: t.gymSchedule.weekday, templateId: t.gymSchedule.templateId, start: t.gymSchedule.startMin, duration: t.gymSchedule.durationMin })
      .from(t.gymSchedule)
      .where(eq(t.gymSchedule.userId, user.id)),
    getActiveSeason(user.id),
    db
      .select({ estimate: t.tasks.estimateMin })
      .from(t.tasks)
      // due today, or overdue from the last two weeks
      .where(and(eq(t.tasks.userId, user.id), isNull(t.tasks.doneAt), lte(t.tasks.dueDate, today), gte(t.tasks.dueDate, addDays(today, -14)))),
  ]);

  const live = blocks.filter((b) => b.skipped == null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const dayBlocks = live.filter((b) => b.date === d);
    const busy: Span[] = dayBlocks.map((b) => ({ startMin: b.start, endMin: b.end }));
    const g = gym.find((x) => x.weekday === i);
    if (g?.templateId && g.start != null && !dayBlocks.some((b) => b.kind === "workout")) busy.push({ startMin: g.start, endMin: g.start + g.duration });
    const from = d === today ? Math.max(dayStart, Math.ceil(nowMin / 15) * 15) : dayStart;
    const { freeMin, windows } = d < today ? { freeMin: 0, windows: [] } : freeIn(busy, from, dayEnd);
    const blocksLeft = d < today ? 0 : dayBlocks.filter((b) => b.done == null && (d > today || b.end > nowMin)).length;
    return { date: d, day: WEEKDAY_SHORT[i], past: d < today, freeMin, windows, blocksLeft };
  });
  const ahead = days.filter((d) => !d.past);
  const freeWeekMin = ahead.reduce((s, d) => s + d.freeMin, 0);

  // Goals: this week from the coach (planned, done, status); another week from its blocks.
  const p = season ? seasonProgress(season, today) : null;
  const weeksLeft = season ? Math.max(0, Math.ceil((diffDays(season.endDate, date) + 1) / 7)) : 0;
  let goals: { title: string; tier: string; targetMin: number; plannedMin: number; doneMin: number; status?: string; reasons?: string[] }[] = [];
  if (season) {
    if (thisWeek) {
      goals = (await getGoalHealth(user.id, today)).map((h) => ({
        title: h.goal.title,
        tier: h.goal.tier,
        targetMin: h.week.targetMin,
        plannedMin: h.week.plannedMin,
        doneMin: Math.max(h.week.doneMin, h.week.focusMin),
        status: h.autoStatus,
        reasons: h.reasons,
      }));
    } else {
      const list = (await getSeasonGoals(user.id, season.id)).filter((g) => g.completedAt == null);
      goals = list.map((g) => ({
        title: g.title,
        tier: g.tier,
        targetMin: Math.round(g.weeklyHours * 60),
        plannedMin: live.filter((b) => b.goalId === g.id).reduce((s, b) => s + (b.end - b.start), 0),
        doneMin: 0,
      }));
    }
  }
  const targetMin = goals.reduce((s, g) => s + g.targetMin, 0);
  const plannedMin = goals.reduce((s, g) => s + Math.min(g.plannedMin, g.targetMin || g.plannedMin), 0);
  const gapMin = goals.reduce((s, g) => s + Math.max(0, g.targetMin - g.plannedMin), 0);
  const usableWeekMin = q15(freeWeekMin * USABLE);
  const todayRow = days.find((d) => d.date === today);

  return {
    dayWindow: `${formatMin(dayStart, true)}–${formatMin(dayEnd, true)}`,
    now: thisWeek ? formatMin(nowMin, true) : null,
    today: todayRow
      ? {
          freeMin: todayRow.freeMin,
          usableMin: q15(todayRow.freeMin * USABLE),
          windows: todayRow.windows,
          blocksLeft: todayRow.blocksLeft,
          openTasks: openToday.length,
          taskEstimateMin: openToday.reduce((s, x) => s + (x.estimate ?? 0), 0),
        }
      : null,
    week: {
      weekStart: ws,
      daysLeft: ahead.length,
      freeMin: freeWeekMin,
      usableMin: usableWeekMin,
      perDay: ahead.map(({ day, date, freeMin, windows }) => ({ day, date, freeMin, windows })),
    },
    season:
      season && p
        ? { name: season.name, week: p.week, of: Math.ceil(p.total / 7), daysLeft: p.daysLeft, weeksLeft, end: season.endDate, capacityHoursPerWeek: season.weeklyCapacityHours }
        : null,
    goals: goals.map((g) => ({
      ...g,
      gapMin: Math.max(0, g.targetMin - g.plannedMin),
      /** hours this goal still gets if it keeps its weekly target to the season's end */
      seasonHoursLeft: Math.round((g.targetMin / 60) * weeksLeft),
    })),
    totals: {
      goalTargetMin: targetMin,
      goalPlannedMin: plannedMin,
      goalGapMin: gapMin,
      /** the unplanned goal time fits in usable free time */
      gapFits: gapMin <= usableWeekMin,
      /** goal targets add up to more than the season's weekly capacity */
      overCapacity: season ? targetMin > season.weeklyCapacityHours * 60 : false,
    },
  };
}

/** One line per fact, for the system prompt. */
export function capacityLines(c: Capacity) {
  const lines: string[] = [];
  if (c.today)
    lines.push(
      `Free today: ${dur(c.today.freeMin)} left in ${c.dayWindow} (about ${dur(c.today.usableMin)} usable)${c.today.windows.length ? `, windows ${c.today.windows.join(", ")}` : ""}; ${c.today.blocksLeft} blocks left, ${c.today.openTasks} open tasks.`,
    );
  lines.push(
    `Free this week: ${dur(c.week.freeMin)} over ${c.week.daysLeft} days (about ${dur(c.week.usableMin)} usable): ${c.week.perDay.map((d) => `${d.day} ${dur(d.freeMin)}`).join(", ")}.`,
  );
  if (c.goals.length)
    lines.push(
      `Goal time this week: ${dur(c.totals.goalPlannedMin)} of ${dur(c.totals.goalTargetMin)} planned, ${dur(c.totals.goalGapMin)} unplanned (${c.totals.gapFits ? "fits" : "does not fit"} in usable free time)${c.totals.overCapacity ? "; goal targets exceed season capacity" : ""}. ${c.goals.map((g) => `${g.title} ${dur(g.plannedMin)}/${dur(g.targetMin)}`).join("; ")}.`,
    );
  if (c.season) lines.push(`Season left: ${c.season.weeksLeft} weeks, ${c.season.daysLeft} days (ends ${c.season.end}).`);
  return lines.map((l) => `- ${l}`).join("\n");
}
