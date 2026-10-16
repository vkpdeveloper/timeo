import "server-only";
import { generateText, isStepCount } from "ai";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db, t } from "@/db";
import type { AiAction } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { addDays, formatLongDate, formatMin, nowMinIn, weekday, WEEKDAY_NAMES } from "@/lib/dates";
import { getActiveSeason } from "@/lib/queries";
import { findModel, type Effort } from "./catalog";
import type { CommandResult } from "./shared";

export type { CommandResult };
import { languageModel } from "./provider";
import { activePlan, buildTools, dayOverview } from "./tools";


async function instructions(user: CurrentUser & { trainingNotes: string | null }) {
  const today = user.today;
  const [overview, season, plan] = await Promise.all([dayOverview(user, today), getActiveSeason(user.id), activePlan(user.id)]);
  const goals = season
    ? await db.select({ title: t.goals.title }).from(t.goals).where(and(eq(t.goals.seasonId, season.id), isNull(t.goals.completedAt)))
    : [];

  return `You are Timeo, a logging and lookup assistant inside a personal planner + gym app.

The user has ADHD. Be extremely brief and plain.
- Logging: call the tools, then reply with at most one short line (max 10 words), e.g. "Logged." or "Logged. Push A done." The app already shows what was saved.
- Questions: use the read tools, then answer in one line. A single word or number is best. Never more than 2 short lines. No preamble, no lists, no markdown, no emojis, no advice unless asked.
- Never invent data. If it's not there, say "No data." or similar in a few words.
- One shot: don't ask follow-up questions. Make the most reasonable assumption and mention it in a few words only if it matters.

Context
- Now: ${WEEKDAY_NAMES[weekday(today)]} ${formatLongDate(today)} (${today}), ${formatMin(nowMinIn(user.timezone))}, timezone ${user.timezone}. Yesterday was ${addDays(today, -1)}. Resolve relative dates ("yesterday", "on Monday") to YYYY-MM-DD; weeks start Monday.
- Units: kg. Dumbbell weights are per hand, cable single-arm weights per arm; reps are per set. "3x8 at 60" = 3 sets × 8 reps at 60 kg. "bench 60 for 8, 8, 6" = three sets at 60 kg. Convert lb to kg. Warm-ups only if the user says so.
- Today's training: ${overview.training.scheduled}${overview.training.prescription.length ? ` — ${overview.training.prescription.join("; ")}` : ""}${overview.training.logged.length ? ` | logged: ${overview.training.logged.join(", ")}` : ""}.
${user.trainingNotes ? `- Training notes: ${user.trainingNotes.replace(/\n/g, " ")}\n` : ""}- Diet targets: ${plan ? `${plan.calories} kcal, ${plan.proteinG}g protein, ${plan.carbsG}g carbs, ${plan.fatG}g fat, ${plan.waterMl} ml water` : "none set"}. Today so far: ${overview.food.kcal} kcal, ${overview.food.protein}g protein, ${overview.waterMl} ml water.
- Goals: ${goals.length ? goals.map((g) => g.title).join("; ") : "none yet"}.
- Food: the user is in India; estimate macros for Indian home food sensibly (1 roti ≈ 100 kcal, 1 cup dal ≈ 180 kcal / 9g protein, 100g paneer ≈ 265 kcal / 18g protein).`;
}

export async function runCommand(user: CurrentUser, input: string): Promise<CommandResult> {
  const settings = await db
    .select({ aiModel: t.users.aiModel, aiEffort: t.users.aiEffort, trainingNotes: t.users.trainingNotes })
    .from(t.users)
    .where(eq(t.users.id, user.id))
    .get();
  const model = await findModel(settings?.aiModel ?? "deepseek-v4.1-flash");
  const effort = (settings?.aiEffort ?? "low") as Effort;
  const id = crypto.randomUUID();
  const actions: AiAction[] = [];
  const started = Date.now();

  let reply = "";
  let error: string | undefined;
  try {
    const result = await generateText({
      model: languageModel(model, id),
      instructions: await instructions({ ...user, trainingNotes: settings?.trainingNotes ?? null }),
      prompt: input,
      tools: buildTools(user, actions),
      stopWhen: isStepCount(8),
      maxOutputTokens: 16_000,
      timeout: { totalMs: 110_000 },
      ...(model.efforts.length > 1 && effort !== "auto" && model.efforts.includes(effort) ? { reasoning: effort } : {}),
    });
    reply = result.text.trim();
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : "The model call failed";
  }

  const ms = Date.now() - started;
  await db.insert(t.aiCommands).values({
    id,
    userId: user.id,
    input,
    reply: reply || null,
    model: model.id,
    effort,
    actions,
    error: error ?? null,
    durationMs: ms,
  });
  return { id, reply, actions, model: model.name, effort, ms, error };
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
  for (const b of ids("body_metrics_update")) {
    const sep = b.indexOf("|");
    stmts.push(
      db
        .update(t.bodyMetrics)
        .set(JSON.parse(b.slice(sep + 1)))
        .where(and(eq(t.bodyMetrics.id, b.slice(0, sep)), eq(t.bodyMetrics.userId, userId))),
    );
  }
  for (const b of ids("daily_update")) {
    const sep = b.indexOf("|");
    stmts.push(
      db
        .update(t.dailyLogs)
        .set(JSON.parse(b.slice(sep + 1)))
        .where(and(eq(t.dailyLogs.userId, userId), eq(t.dailyLogs.date, b.slice(0, sep)))),
    );
  }
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
