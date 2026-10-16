import "server-only";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, t } from "@/db";
import type { Goal, Milestone } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { addDays, diffDays, formatDuration, nowMinIn, startOfWeek } from "@/lib/dates";
import { getActiveSeason, getSeasonGoals } from "@/lib/queries";

/*
 * Coach: deterministic rules, no AI.
 * Reads this week's blocks, focus sessions, weekly steps and milestones and
 * turns them into a status per goal, a plan strength score and a daily read.
 * Weeks start on Monday. Copy is kept tiny on purpose.
 */

export type GoalStatus = "on_track" | "adjust" | "off_track";

export type CoachRecommendationKind = "protect_time" | "schedule_step" | "add_weekly_step" | "add_milestone";

/** One-tap next action for a goal. `protect_time` → protectTime(goalId); `schedule_step` → scheduleStep(taskId). */
export type CoachRecommendation = {
  kind: CoachRecommendationKind;
  /** ≤ 6 words, e.g. "Protect 2h tomorrow" */
  label: string;
  goalId: string;
  taskId?: string;
};

/** This week's numbers for one goal (Monday to Sunday). */
export type GoalWeek = {
  weekStart: string;
  /** goal.weeklyHours in minutes */
  targetMin: number;
  /** minutes of goal blocks this week, skipped blocks excluded */
  plannedMin: number;
  /** minutes of goal blocks marked done */
  doneMin: number;
  /** minutes focused in focus sessions linked to the goal */
  focusMin: number;
  /** total times the goal's blocks were moved this week */
  rescheduleCount: number;
  skippedCount: number;
  stepsDone: number;
  stepsTotal: number;
};

export type GoalHealth = {
  goal: Goal;
  autoStatus: GoalStatus;
  /** short plain reasons, most important first (max 3) */
  reasons: string[];
  week: GoalWeek;
  milestonesTotal: number;
  milestonesDone: number;
  overdueMilestones: Milestone[];
  /** first open milestone by date (undated last) */
  nextMilestone: Milestone | null;
  recommendation?: CoachRecommendation;
};

export type PlanStrengthLabel = "Weak" | "Fair" | "Strong" | "Very strong";
export type PlanStrength = { score: number; label: PlanStrengthLabel; tips: string[] };

export type DailyRead = { headline: string; detail?: string };

/** Minutes as "2h 30m"; zero reads "0h". */
const hours = (min: number) => {
  const m = Math.max(0, Math.round(min / 15) * 15);
  return m === 0 ? "0h" : formatDuration(m);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const FILLER = new Set(["a", "an", "the", "of", "to", "for", "and", "in", "on", "my", "with", "by", "at"]);

/** First few words of a title so headlines stay short ("Run a 10k under 55 min" -> "Run a 10k"). */
export function shortTitle(title: string, words = 3) {
  const parts = title.trim().split(/\s+/).slice(0, words);
  while (parts.length > 1 && FILLER.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts.join(" ");
}

/** Health of each open goal in the active season, in tier order. Empty without a season. */
export async function getGoalHealth(userId: string, today: string): Promise<GoalHealth[]> {
  const season = await getActiveSeason(userId);
  if (!season) return [];
  const goals = (await getSeasonGoals(userId, season.id)).filter((g) => g.completedAt == null);
  if (goals.length === 0) return [];

  const ids = goals.map((g) => g.id);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [blocks, sessions, steps, milestones] = await Promise.all([
    db
      .select()
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, userId), inArray(t.blocks.goalId, ids), gte(t.blocks.date, weekStart), lte(t.blocks.date, weekEnd))),
    db
      .select({ goalId: t.focusSessions.goalId, focusedMin: t.focusSessions.focusedMin })
      .from(t.focusSessions)
      .where(
        and(
          eq(t.focusSessions.userId, userId),
          inArray(t.focusSessions.goalId, ids),
          gte(t.focusSessions.date, weekStart),
          lte(t.focusSessions.date, weekEnd),
        ),
      ),
    db
      .select()
      .from(t.tasks)
      .where(and(eq(t.tasks.userId, userId), inArray(t.tasks.goalId, ids), eq(t.tasks.weekStart, weekStart))),
    db.select().from(t.milestones).where(and(eq(t.milestones.userId, userId), inArray(t.milestones.goalId, ids))),
  ]);

  // Days of this week that count: a season that started mid-week gets a fair start.
  const elapsed = diffDays(today, season.startDate > weekStart ? season.startDate : weekStart); // 0…6
  const freshSeason = diffDays(today, season.startDate) < 2;

  return goals.map((goal) => {
    const gBlocks = blocks.filter((b) => b.goalId === goal.id);
    const live = gBlocks.filter((b) => b.skippedAt == null);
    const gSteps = steps.filter((s) => s.goalId === goal.id);
    const gMilestones = milestones
      .filter((m) => m.goalId === goal.id)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.sortOrder - b.sortOrder);
    const open = gMilestones.filter((m) => m.doneAt == null);

    const week: GoalWeek = {
      weekStart,
      targetMin: Math.round(goal.weeklyHours * 60),
      plannedMin: live.reduce((s, b) => s + (b.endMin - b.startMin), 0),
      doneMin: live.filter((b) => b.doneAt != null).reduce((s, b) => s + (b.endMin - b.startMin), 0),
      focusMin: sessions.filter((s) => s.goalId === goal.id).reduce((s, f) => s + f.focusedMin, 0),
      rescheduleCount: gBlocks.reduce((s, b) => s + b.rescheduleCount, 0),
      skippedCount: gBlocks.length - live.length,
      stepsDone: gSteps.filter((s) => s.doneAt != null).length,
      stepsTotal: gSteps.length,
    };
    const overdue = open.filter((m) => m.dueDate != null && m.dueDate < today);

    // Score drift signals; weight decides the status and the order of reasons.
    const signals: { w: number; text: string }[] = [];
    const target = week.targetMin;
    if (target > 0) {
      if (week.plannedMin === 0) signals.push({ w: elapsed >= 2 ? 2 : 1, text: "No time blocked this week" });
      else if (week.plannedMin < target * 0.6) signals.push({ w: 1, text: `Only ${hours(week.plannedMin)} of ${hours(target)} blocked` });
    }
    if (week.rescheduleCount >= 3) signals.push({ w: 2, text: `Its blocks moved ${week.rescheduleCount} times` });
    else if (week.rescheduleCount === 2) signals.push({ w: 1, text: "Its blocks moved twice" });
    if (week.skippedCount >= 2) signals.push({ w: 1, text: `${plural(week.skippedCount, "block")} skipped` });
    if (overdue.length) signals.push({ w: Math.min(2, overdue.length), text: overdue.length === 1 ? "A milestone is overdue" : `${overdue.length} milestones overdue` });
    if (week.stepsTotal === 0) signals.push({ w: 1, text: "No weekly step yet" });
    else if (elapsed >= 4 && week.stepsDone < week.stepsTotal)
      signals.push({ w: 1, text: `${plural(week.stepsTotal - week.stepsDone, "step")} still open` });
    // Blocks already in the past this week that were neither done nor focused on.
    const pastMin = live.filter((b) => b.date < today).reduce((s, b) => s + (b.endMin - b.startMin), 0);
    if (pastMin >= 60 && Math.max(week.doneMin, week.focusMin) < pastMin * 0.5) signals.push({ w: 1, text: "Past blocks not done" });

    const points = signals.reduce((s, x) => s + x.w, 0);
    // never "off track" in the first two days of a season
    const autoStatus: GoalStatus = points >= 3 && !freshSeason ? "off_track" : points >= 1 ? "adjust" : "on_track";

    let reasons = signals.sort((a, b) => b.w - a.w).map((s) => s.text);
    if (reasons.length === 0) {
      const effort = Math.max(week.doneMin, week.focusMin);
      reasons = [
        target > 0 ? `${hours(week.plannedMin)} of ${hours(target)} blocked` : "Time is blocked",
        effort > 0 ? `${hours(effort)} done this week` : week.stepsTotal ? `${week.stepsDone} of ${week.stepsTotal} steps done` : "",
      ].filter(Boolean);
    }

    return {
      goal,
      autoStatus,
      reasons: reasons.slice(0, 3),
      week,
      milestonesTotal: gMilestones.length,
      milestonesDone: gMilestones.length - open.length,
      overdueMilestones: overdue,
      nextMilestone: open[0] ?? null,
      recommendation: recommend(goal, week, gSteps, gBlocks, gMilestones.length, open.length),
    };
  });
}

function recommend(
  goal: Goal,
  week: GoalWeek,
  steps: { id: string; doneAt: number | null; title: string }[],
  blocks: { taskId: string | null; protected: boolean; skippedAt: number | null }[],
  milestonesTotal: number,
  milestonesOpen: number,
): CoachRecommendation | undefined {
  const goalId = goal.id;
  const short = week.targetMin > 0 && week.plannedMin < week.targetMin * 0.6;
  const hasProtected = blocks.some((b) => b.protected && b.skippedAt == null);
  if (short || (week.rescheduleCount >= 3 && !hasProtected)) {
    const gap = Math.max(60, Math.min(120, week.targetMin - week.plannedMin));
    return { kind: "protect_time", label: `Protect ${hours(gap)} tomorrow`, goalId };
  }
  if (week.stepsTotal === 0) return { kind: "add_weekly_step", label: "Add a weekly step", goalId };
  const unscheduled = steps.find((s) => s.doneAt == null && !blocks.some((b) => b.taskId === s.id));
  if (unscheduled) return { kind: "schedule_step", label: "Schedule the next step", goalId, taskId: unscheduled.id };
  if (milestonesTotal === 0 || milestonesOpen === 0) return { kind: "add_milestone", label: "Add a milestone", goalId };
  return undefined;
}

/** How realistic the season plan is, 0-100, with up to 3 short tips. */
export async function getPlanStrength(userId: string, seasonId: string, goals: GoalHealth[]): Promise<PlanStrength> {
  const season = await db
    .select({ cap: t.seasons.weeklyCapacityHours })
    .from(t.seasons)
    .where(and(eq(t.seasons.id, seasonId), eq(t.seasons.userId, userId)))
    .get();
  if (!season || goals.length === 0) return { score: 0, label: "Weak", tips: ["Add your first goal"] };

  const n = goals.length;
  const core = goals.filter((g) => g.goal.tier === "core").length;
  const withOutcome = goals.filter((g) => g.goal.outcome?.trim()).length;
  const withMilestones = goals.filter((g) => g.milestonesTotal > 0).length;
  const withStep = goals.filter((g) => g.week.stepsTotal > 0).length;
  const totalHours = goals.reduce((s, g) => s + g.goal.weeklyHours, 0);
  const targetMin = goals.reduce((s, g) => s + g.week.targetMin, 0);
  const coverage =
    targetMin > 0 ? goals.reduce((s, g) => s + Math.min(g.week.plannedMin, g.week.targetMin), 0) / targetMin : 1;

  let score = 0;
  const tips: { w: number; text: string }[] = [];

  if (core >= 1 && core <= 3) score += 15;
  else if (core > 3) tips.push({ w: 15, text: "Keep core goals to 3" });
  else tips.push({ w: 15, text: "Pick one core goal" });

  score += (15 * withOutcome) / n;
  if (withOutcome < n) tips.push({ w: 15 * (1 - withOutcome / n), text: n - withOutcome === 1 ? "Add an outcome to one goal" : `Add outcomes to ${n - withOutcome} goals` });

  score += (15 * withMilestones) / n;
  if (withMilestones < n) tips.push({ w: 15 * (1 - withMilestones / n), text: n - withMilestones === 1 ? "Add milestones to one goal" : `Add milestones to ${n - withMilestones} goals` });

  score += (15 * withStep) / n;
  if (withStep < n) tips.push({ w: 15 * (1 - withStep / n), text: "Set this week's steps" });

  const cap = season.cap;
  if (totalHours <= cap) score += 20;
  else {
    if (totalHours <= cap * 1.2) score += 10;
    tips.push({ w: 20, text: `Trim ${hours((totalHours - cap) * 60)} to fit capacity` });
  }

  score += 20 * coverage;
  if (coverage < 0.95) tips.push({ w: 20 * (1 - coverage), text: `Block ${hours(targetMin * (1 - coverage))} more this week` });

  const s = Math.round(Math.max(0, Math.min(100, score)));
  const label: PlanStrengthLabel = s >= 85 ? "Very strong" : s >= 65 ? "Strong" : s >= 40 ? "Fair" : "Weak";
  return { score: s, label, tips: tips.sort((a, b) => b.w - a.w).slice(0, 3).map((x) => x.text) };
}

/** One glanceable line about today: e.g. "Strong morning. Ship v2 needs time." */
export async function getDailyRead(user: CurrentUser): Promise<DailyRead> {
  const today = user.today;
  const nowMin = nowMinIn(user.timezone);
  const part = nowMin < 12 * 60 ? "morning" : nowMin < 17 * 60 ? "afternoon" : "evening";

  const [blocks, sessions, health] = await Promise.all([
    db
      .select()
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, today), isNull(t.blocks.skippedAt))),
    db
      .select({ focusedMin: t.focusSessions.focusedMin })
      .from(t.focusSessions)
      .where(and(eq(t.focusSessions.userId, user.id), eq(t.focusSessions.date, today))),
    getGoalHealth(user.id, today),
  ]);

  const focusMin = sessions.reduce((s, f) => s + f.focusedMin, 0);
  const done = blocks.filter((b) => b.doneAt != null).length;
  const pastUndone = blocks.filter((b) => b.doneAt == null && b.endMin <= nowMin).length;

  let first: string;
  if (blocks.length === 0 && focusMin === 0) first = nowMin < 12 * 60 ? "Open day ahead." : "Nothing blocked today.";
  else if (focusMin >= 90 || done >= 2) first = `Strong ${part}.`;
  else if (focusMin > 0 || done > 0) first = "Good start.";
  else if (pastUndone > 0) first = `Slow ${part} so far.`;
  else first = `${plural(blocks.length, "block")} today.`;

  const rank = { off_track: 0, adjust: 1, on_track: 2 } as const;
  const drifting = health.filter((g) => g.autoStatus !== "on_track").sort((a, b) => rank[a.autoStatus] - rank[b.autoStatus]);
  const worst = drifting[0];

  if (health.length === 0) return { headline: first, detail: "Set goals to get a daily read." };
  const second = worst ? `${shortTitle(worst.goal.title)} needs time.` : "Goals on track.";

  const stats = [
    blocks.length ? `${done} of ${plural(blocks.length, "block")} done` : null,
    focusMin ? `${formatDuration(focusMin)} focus` : null,
  ].filter(Boolean);
  const detail = worst ? worst.reasons[0] : stats.length ? stats.join(" · ") : undefined;

  return { headline: `${first} ${second}`, detail };
}
