import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db, t } from "@/db";
import type { AiAction } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { addDays, formatLongDate, formatMin, nowMinIn, weekday, WEEKDAY_NAMES } from "@/lib/dates";
import { getActiveSeason, seasonProgress } from "@/lib/queries";
import { buildGpsTools, gpsUndo } from "./gps-tools";
import { activePlan, buildTools, dayOverview } from "./tools";

// The stable part goes first so providers can cache it across requests.
const PRIMER = `You are Timi, the assistant inside Timeo, a personal planner + gym app built on the GPS method. If asked your name, you are Timi.

HOW TIMEO WORKS (GPS = Goal, Plan, System)
- Season: 12 weeks (84 days). One active season holds a few goals. Weekly capacity = hours/week the user can give goals.
- Goal: concrete outcome by the season's end ("what should have happened by <end date>?"). Tiers: core (what matters most, max 3), secondary (next), support (maintain). Each goal has weekly hours, an area, a colour, and a System (the recurring trigger: when/where it happens).
- Plan: goals break into dated milestones, then small weekly steps (one next action per goal each week), then time blocks on the calendar. Protected focus blocks go in the mornings when possible. Total goal hours should fit capacity.
- System: blocks repeat on the user's rhythm; focus sessions log real time; evening reflection daily; 5-minute weekly review with an honest status per goal: on_track / adjust / off_track.
- Coach rules: a goal drifts when it has no time blocked, less than its weekly hours, blocks moved 2-3+ times, skipped blocks, overdue milestones, or no weekly step. Fix drift by protecting time, adding a weekly step, or adjusting the goal.
- Training is part of the plan: a weekly gym split (routines like Push A) with rep ranges; workouts can be logged set by set.

WHAT YOU DO
- Act, don't describe. Use tools to create/change seasons, goals, milestones, weekly steps, tasks, time blocks, gym days, and to log workouts, meals, water, body weight, sleep and reflections.
- Planning a week: call get_plan and get_week first, then add_blocks once with all blocks (respect free windows, gym slots and each goal's weekly hours; core goals first, mornings for deep work; 60-120 min blocks), and add_weekly_steps for goals missing one.
- Seasons and goals are the user's choices. Only create a season or goals when the user explicitly asks and names what they want; then fill gaps sensibly (realistic hours within capacity, 2-3 milestones per goal spread over the 12 weeks).
- If there is no active season and the user asks to plan, plan only around what exists (calendar, gym, tasks) and say in one line that a season would help ("No season yet. Want to set one up?").
- Questions: use read tools, then answer.
- Never invent data, goals or plans the user didn't ask for. Never delete anything unless asked. Don't ask follow-up questions unless truly blocked; pick the reasonable default.

HOW YOU TALK
The user has ADHD. Be extremely brief and plain.
- After actions: one short line (max 12 words). The app already shows each saved item.
- Answers: one line. A word or number is best. Max 3 short lines, or a tiny list only if they asked for a plan.
- No preamble, no filler, no emojis, no headings.

UNITS
kg. Dumbbell weights are per hand; single-arm cable weights per arm; reps per set. "3x8 at 60" = 3 sets × 8 reps × 60 kg. "bench 60 for 8, 8, 6" = three sets at 60 kg. Convert lb to kg. Warm-ups only if said. The user is in India: estimate Indian home food sensibly (1 roti ≈ 100 kcal; 1 cup dal ≈ 180 kcal, 9g protein; 100g paneer ≈ 265 kcal, 18g protein).`;

export async function buildInstructions(user: CurrentUser, trainingNotes: string | null) {
  const today = user.today;
  const [overview, season, plan] = await Promise.all([dayOverview(user, today), getActiveSeason(user.id), activePlan(user.id)]);
  const goals = season
    ? await db
        .select({ title: t.goals.title, tier: t.goals.tier, hours: t.goals.weeklyHours, status: t.goals.status })
        .from(t.goals)
        .where(and(eq(t.goals.seasonId, season.id), isNull(t.goals.completedAt)))
    : [];
  const p = season ? seasonProgress(season, today) : null;

  return `${PRIMER}

NOW
- ${WEEKDAY_NAMES[weekday(today)]} ${formatLongDate(today)} (${today}), ${formatMin(nowMinIn(user.timezone))}, ${user.timezone}. Yesterday ${addDays(today, -1)}. Weeks start Monday. Planner day ${formatMin(user.dayStartMin, true)}–${formatMin(user.dayEndMin, true)}.
- Season: ${season && p ? `"${season.name}" day ${p.day}/${p.total} (week ${p.week}), ends ${season.endDate}, capacity ${season.weeklyCapacityHours}h/wk` : "none active"}.
- Goals: ${goals.length ? goals.map((g) => `${g.title} (${g.tier}, ${g.hours}h/wk, ${g.status})`).join("; ") : "none"}.
- Today's calendar: ${overview.calendar.length ? overview.calendar.join("; ") : "empty"}.
- Today's training: ${overview.training.scheduled}${overview.training.prescription.length ? ` — ${overview.training.prescription.join("; ")}` : ""}${overview.training.logged.length ? ` | logged: ${overview.training.logged.join(", ")}` : ""}.
${trainingNotes ? `- Training notes: ${trainingNotes.replace(/\n/g, " ")}\n` : ""}- Diet targets: ${plan ? `${plan.calories} kcal, ${plan.proteinG}g P, ${plan.carbsG}g C, ${plan.fatG}g F, ${plan.waterMl} ml water` : "none"}. Eaten today: ${overview.food.kcal} kcal, ${overview.food.protein}g P, ${overview.waterMl} ml water.`;
}

/** Collects what a tool call saved, even when several tools run in parallel. */
const callLog = new AsyncLocalStorage<AiAction[]>();

export type ActionSink = { push: (a: AiAction) => void };

/**
 * All tools, each wrapped so its output also lists the rows it saved
 * ({ saved: [{ label, icon }] }) for the UI to render.
 */
export function buildAllTools(user: CurrentUser, actions: AiAction[]) {
  const sink: ActionSink = {
    push: (a) => {
      actions.push(a);
      callLog.getStore()?.push(a);
    },
  };
  const tools = { ...buildTools(user, sink), ...buildGpsTools(user, sink) };
  for (const tl of Object.values(tools) as { execute?: (...args: never[]) => unknown }[]) {
    const run = tl.execute;
    if (!run) continue;
    tl.execute = (async (...args: never[]) => {
      const mine: AiAction[] = [];
      const out = await callLog.run(mine, () => run(...args));
      const saved = mine.filter((a) => a.label).map((a) => ({ label: a.label, icon: a.icon }));
      return saved.length && out && typeof out === "object" && !Array.isArray(out) ? { ...out, saved } : out;
    }) as never;
  }
  return tools;
}

/** Reverts everything a command wrote, in one batch. */
export async function undoCommand(userId: string, commandId: string) {
  const cmd = await db
    .select()
    .from(t.aiCommands)
    .where(and(eq(t.aiCommands.id, commandId), eq(t.aiCommands.userId, userId)))
    .get();
  if (!cmd || cmd.undoneAt) return;

  const ids = (table: string) => cmd.actions.filter((a) => a.table === table).map((a) => a.id);
  const setIds = ids("set_logs");
  const ownedSets = setIds.length
    ? (
        await db
          .select({ id: t.setLogs.id })
          .from(t.setLogs)
          .innerJoin(t.workoutLogs, eq(t.workoutLogs.id, t.setLogs.workoutLogId))
          .where(and(inArray(t.setLogs.id, setIds), eq(t.workoutLogs.userId, userId)))
      ).map((r) => r.id)
    : [];

  const stmts: BatchItem<"sqlite">[] = [
    db.update(t.aiCommands).set({ undoneAt: Date.now() }).where(eq(t.aiCommands.id, commandId)),
  ];
  // reverse order so later edits are undone before the rows they touched
  for (const a of [...cmd.actions].reverse()) stmts.push(...gpsUndo(a, userId));
  if (ownedSets.length) stmts.push(db.delete(t.setLogs).where(inArray(t.setLogs.id, ownedSets)));
  const del = <T extends typeof t.workoutLogs | typeof t.mealLogs | typeof t.bodyMetrics | typeof t.tasks | typeof t.blocks | typeof t.exercises>(
    table: T,
    list: string[],
  ) => list.length && stmts.push(db.delete(table).where(and(inArray(table.id, list), eq(table.userId, userId))));
  del(t.workoutLogs, ids("workout_logs"));
  del(t.mealLogs, ids("meal_logs"));
  del(t.bodyMetrics, ids("body_metrics"));
  del(t.tasks, ids("tasks"));
  del(t.blocks, ids("blocks"));
  del(t.exercises, ids("exercises"));
  const reopened = ids("task_done");
  if (reopened.length)
    stmts.push(db.update(t.tasks).set({ doneAt: null }).where(and(inArray(t.tasks.id, reopened), eq(t.tasks.userId, userId))));
  for (const w of ids("water")) {
    const [date, ml] = w.split("|");
    stmts.push(
      db
        .update(t.dailyLogs)
        .set({ waterMl: sql`max(0, ${t.dailyLogs.waterMl} - ${Number(ml)})` })
        .where(and(eq(t.dailyLogs.userId, userId), eq(t.dailyLogs.date, date))),
    );
  }
  for (const [table, target] of [
    ["body_metrics_update", "body"],
    ["daily_update", "daily"],
  ] as const) {
    for (const b of ids(table)) {
      const sep = b.indexOf("|");
      const head = b.slice(0, sep);
      const prev = JSON.parse(b.slice(sep + 1));
      stmts.push(
        target === "body"
          ? db.update(t.bodyMetrics).set(prev).where(and(eq(t.bodyMetrics.id, head), eq(t.bodyMetrics.userId, userId)))
          : db.update(t.dailyLogs).set(prev).where(and(eq(t.dailyLogs.userId, userId), eq(t.dailyLogs.date, head))),
      );
    }
  }
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
