import "server-only";
import { tool } from "ai";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { AiAction } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import type { ActionSink } from "./run";
import { addDays, formatMin, isValidISODate, parseTime, weekday } from "@/lib/dates";
import { getActiveSeason } from "@/lib/queries";
import { bestMatch } from "./match";

/*
 * Tools the command bar model can call. Write tools record every row they
 * create in `actions` so a command can be undone in one tap.
 */

const day = (user: CurrentUser, d?: string | null) => (d && isValidISODate(d) ? d : user.today);

const DateArg = z.string().describe("YYYY-MM-DD. Omit for today.").optional();

export function buildTools(user: CurrentUser, actions: ActionSink) {
  const push = (a: AiAction) => actions.push(a);

  return {
    // ───────────────────────────── Writes ─────────────────────────────

    log_workout: tool({
      description:
        "Log gym training: sets done, or mark a day skipped / done-but-unlogged. Adds to the existing session that day if there is one. Weights in kg; dumbbell weights are per hand.",
      inputSchema: z.object({
        date: DateArg,
        session: z.string().describe("Routine/session name if known, e.g. 'Push A'. Omit to use today's scheduled session.").optional(),
        status: z.enum(["completed", "in_progress", "skipped", "unlogged"]).describe("completed = trained and logging sets; skipped = didn't train; unlogged = trained but no set details").default("completed"),
        skipReason: z.string().optional(),
        exercises: z
          .array(
            z.object({
              name: z.string(),
              sets: z.array(
                z.object({
                  weightKg: z.number().nullable().describe("null if unknown or bodyweight"),
                  reps: z.number().int().nullable(),
                  warmup: z.boolean().default(false),
                  note: z.string().optional(),
                }),
              ),
            }),
          )
          .default([]),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const d = day(user, input.date);
        const [templates, schedule] = await Promise.all([
          db.select().from(t.workoutTemplates).where(eq(t.workoutTemplates.userId, user.id)),
          db
            .select()
            .from(t.gymSchedule)
            .where(and(eq(t.gymSchedule.userId, user.id), eq(t.gymSchedule.weekday, weekday(d))))
            .get(),
        ]);
        const planned = templates.find((x) => x.id === schedule?.templateId);
        const chosen = (input.session && bestMatch(templates, input.session)) || planned;

        let log = await db
          .select()
          .from(t.workoutLogs)
          .where(and(eq(t.workoutLogs.userId, user.id), eq(t.workoutLogs.date, d)))
          .orderBy(desc(t.workoutLogs.startedAt))
          .get();

        if (!log) {
          const id = crypto.randomUUID();
          const name = chosen?.name ?? input.session ?? (input.status === "skipped" ? "Skipped" : "Workout");
          await db.insert(t.workoutLogs).values({
            id,
            userId: user.id,
            templateId: chosen?.id ?? null,
            plannedTemplateId: planned?.id ?? null,
            name,
            date: d,
            status: input.status,
            skipReason: input.skipReason ?? null,
            startedAt: Date.now(),
            endedAt: input.status === "in_progress" ? null : Date.now(),
            notes: input.notes ?? null,
          });
          log = (await db.select().from(t.workoutLogs).where(eq(t.workoutLogs.id, id)).get())!;
          push({ table: "workout_logs", id, label: input.status === "skipped" ? `${name} skipped` : `${name} · ${d === user.today ? "today" : d}`, icon: "dumbbell" });
        } else if (input.status !== log.status || input.skipReason || input.notes) {
          await db
            .update(t.workoutLogs)
            .set({
              status: input.exercises.length && log.status === "in_progress" ? "in_progress" : input.status,
              skipReason: input.skipReason ?? log.skipReason,
              notes: input.notes ? [log.notes, input.notes].filter(Boolean).join("\n") : log.notes,
            })
            .where(eq(t.workoutLogs.id, log.id));
        }

        if (!input.exercises.length) return { ok: true, session: log.name, date: d, status: input.status };

        const library = await db.select().from(t.exercises).where(eq(t.exercises.userId, user.id));
        const existingSets = await db.select().from(t.setLogs).where(eq(t.setLogs.workoutLogId, log.id));
        let nextOrder = existingSets.reduce((m, s) => Math.max(m, s.exerciseOrder + 1), 0);
        const summary: string[] = [];

        for (const ex of input.exercises) {
          let exercise = bestMatch(library, ex.name);
          if (!exercise) {
            const id = crypto.randomUUID();
            await db.insert(t.exercises).values({ id, userId: user.id, name: ex.name, muscle: "full_body", equipment: null });
            exercise = (await db.select().from(t.exercises).where(eq(t.exercises.id, id)).get())!;
            library.push(exercise);
            push({ table: "exercises", id, label: `New exercise: ${ex.name}`, icon: "plus" });
          }
          const prior = existingSets.filter((s) => s.exerciseId === exercise.id);
          const order = prior[0]?.exerciseOrder ?? nextOrder++;
          let idx = prior.reduce((m, s) => Math.max(m, s.setIndex + 1), 0);
          const rows = ex.sets.map((s) => ({
            id: crypto.randomUUID(),
            workoutLogId: log.id,
            exerciseId: exercise.id,
            exerciseOrder: order,
            setIndex: idx++,
            warmup: s.warmup,
            reps: s.reps,
            weightKg: s.weightKg,
            note: s.note ?? null,
            done: true,
          }));
          if (rows.length) await db.insert(t.setLogs).values(rows);
          const working = ex.sets.filter((s) => !s.warmup);
          const desc =
            working.length && working.every((s) => s.weightKg === working[0].weightKg && s.reps === working[0].reps)
              ? `${working.length}×${working[0].reps ?? "?"}${working[0].weightKg != null ? ` @ ${working[0].weightKg} kg` : ""}`
              : ex.sets.map((s) => `${s.warmup ? "wu " : ""}${s.weightKg ?? "?"}×${s.reps ?? "?"}`).join(" · ");
          rows.forEach((r, i) =>
            push({ table: "set_logs", id: r.id, label: i === 0 ? `${exercise.name} ${desc}` : "", icon: "dumbbell" }),
          );
          summary.push(`${exercise.name}: ${desc}`);
        }
        if (log.status !== "in_progress" && input.status === "completed") {
          await db.update(t.workoutLogs).set({ status: "completed", endedAt: log.endedAt ?? Date.now() }).where(eq(t.workoutLogs.id, log.id));
        }
        return { ok: true, session: log.name, date: d, logged: summary };
      },
    }),

    log_meal: tool({
      description: "Log food eaten. Estimate calories and macros from typical portions if the user didn't give them.",
      inputSchema: z.object({
        date: DateArg,
        name: z.string().describe("Short name, e.g. 'Paneer bhurji + 2 rotis'"),
        calories: z.number().int(),
        proteinG: z.number().int(),
        carbsG: z.number().int(),
        fatG: z.number().int(),
        estimated: z.boolean().describe("true if you estimated the numbers"),
      }),
      execute: async (m) => {
        const id = crypto.randomUUID();
        await db.insert(t.mealLogs).values({
          id,
          userId: user.id,
          date: day(user, m.date),
          name: m.name,
          calories: Math.max(0, m.calories),
          proteinG: Math.max(0, m.proteinG),
          carbsG: Math.max(0, m.carbsG),
          fatG: Math.max(0, m.fatG),
        });
        push({ table: "meal_logs", id, label: `${m.name} · ${m.calories} kcal · ${m.proteinG}g P${m.estimated ? " (est.)" : ""}`, icon: "meal" });
        return { ok: true };
      },
    }),

    add_water: tool({
      description: "Add water drunk, in ml (a glass ≈ 250 ml, a bottle ≈ 500–1000 ml).",
      inputSchema: z.object({ ml: z.number().int().positive(), date: DateArg }),
      execute: async ({ ml, date }) => {
        const d = day(user, date);
        await db
          .insert(t.dailyLogs)
          .values({ userId: user.id, date: d, waterMl: ml })
          .onConflictDoUpdate({ target: [t.dailyLogs.userId, t.dailyLogs.date], set: { waterMl: sql`${t.dailyLogs.waterMl} + ${ml}` } });
        push({ table: "water", id: `${d}|${ml}`, label: `Water +${ml} ml`, icon: "water" });
        return { ok: true };
      },
    }),

    log_body: tool({
      description: "Log body weight (kg) and optionally body fat % or waist (cm). Convert lb to kg.",
      inputSchema: z.object({
        date: DateArg,
        weightKg: z.number().optional(),
        bodyFatPct: z.number().optional(),
        waistCm: z.number().optional(),
      }),
      execute: async (b) => {
        const d = day(user, b.date);
        const prev = await db
          .select()
          .from(t.bodyMetrics)
          .where(and(eq(t.bodyMetrics.userId, user.id), eq(t.bodyMetrics.date, d)))
          .get();
        const id = prev?.id ?? crypto.randomUUID();
        const values = {
          weightKg: b.weightKg ?? prev?.weightKg ?? null,
          bodyFatPct: b.bodyFatPct ?? prev?.bodyFatPct ?? null,
          waistCm: b.waistCm ?? prev?.waistCm ?? null,
        };
        if (prev) await db.update(t.bodyMetrics).set(values).where(eq(t.bodyMetrics.id, id));
        else await db.insert(t.bodyMetrics).values({ id, userId: user.id, date: d, ...values });
        push({
          table: prev ? "body_metrics_update" : "body_metrics",
          id: prev ? `${id}|${JSON.stringify({ weightKg: prev.weightKg, bodyFatPct: prev.bodyFatPct, waistCm: prev.waistCm })}` : id,
          label: [b.weightKg && `${b.weightKg} kg`, b.bodyFatPct && `${b.bodyFatPct}% fat`, b.waistCm && `waist ${b.waistCm} cm`].filter(Boolean).join(" · "),
          icon: "scale",
        });
        return { ok: true };
      },
    }),

    log_day: tool({
      description: "Log steps and/or sleep hours for a day.",
      inputSchema: z.object({ date: DateArg, steps: z.number().int().optional(), sleepHours: z.number().optional() }),
      execute: async ({ date, steps, sleepHours }) => {
        const d = day(user, date);
        const prev = await db
          .select({ steps: t.dailyLogs.steps, sleepHours: t.dailyLogs.sleepHours })
          .from(t.dailyLogs)
          .where(and(eq(t.dailyLogs.userId, user.id), eq(t.dailyLogs.date, d)))
          .get();
        const set: { steps?: number; sleepHours?: number } = {};
        if (steps != null) set.steps = steps;
        if (sleepHours != null) set.sleepHours = sleepHours;
        await db
          .insert(t.dailyLogs)
          .values({ userId: user.id, date: d, ...set })
          .onConflictDoUpdate({ target: [t.dailyLogs.userId, t.dailyLogs.date], set });
        push({
          table: "daily_update",
          id: `${d}|${JSON.stringify({ steps: prev?.steps ?? null, sleepHours: prev?.sleepHours ?? null })}`,
          label: [steps != null && `${steps.toLocaleString()} steps`, sleepHours != null && `${sleepHours}h sleep`].filter(Boolean).join(" · "),
          icon: "moon",
        });
        return { ok: true };
      },
    }),

    add_task: tool({
      description: "Create a to-do. Link it to a goal when it clearly belongs to one.",
      inputSchema: z.object({
        title: z.string(),
        dueDate: DateArg,
        dueTime: z.string().describe("HH:MM 24h").optional(),
        goal: z.string().describe("Goal title (fuzzy)").optional(),
      }),
      execute: async (x) => {
        const goal = x.goal ? await findGoal(user.id, x.goal) : undefined;
        const id = crypto.randomUUID();
        await db.insert(t.tasks).values({
          id,
          userId: user.id,
          title: x.title,
          goalId: goal?.id ?? null,
          dueDate: x.dueDate && isValidISODate(x.dueDate) ? x.dueDate : user.today,
          dueMin: parseTime(x.dueTime),
        });
        push({ table: "tasks", id, label: `Task: ${x.title}`, icon: "task" });
        return { ok: true, goal: goal?.title ?? null };
      },
    }),

    complete_task: tool({
      description: "Mark an open task as done, found by title.",
      inputSchema: z.object({ title: z.string() }),
      execute: async ({ title }) => {
        const open = await db
          .select({ id: t.tasks.id, name: t.tasks.title })
          .from(t.tasks)
          .where(and(eq(t.tasks.userId, user.id), isNull(t.tasks.doneAt)));
        const task = bestMatch(open, title);
        if (!task) return { ok: false, error: "No matching open task" };
        await db.update(t.tasks).set({ doneAt: Date.now() }).where(eq(t.tasks.id, task.id));
        push({ table: "task_done", id: task.id, label: `Done: ${task.name}`, icon: "check" });
        return { ok: true, task: task.name };
      },
    }),

    // ───────────────────────────── Reads ─────────────────────────────

    get_day: tool({
      description: "Everything about one day: calendar blocks, tasks, training, food, water, sleep, focus.",
      inputSchema: z.object({ date: DateArg }),
      execute: async ({ date }) => dayOverview(user, day(user, date)),
    }),

    get_training: tool({
      description: "Training history: sessions with sets, optionally for one exercise. Use for PRs, last weights, volume, consistency.",
      inputSchema: z.object({
        from: DateArg,
        to: DateArg,
        exercise: z.string().optional(),
        limit: z.number().int().default(12),
      }),
      execute: async ({ from, to, exercise, limit }) => {
        const logs = await db
          .select()
          .from(t.workoutLogs)
          .where(
            and(
              eq(t.workoutLogs.userId, user.id),
              gte(t.workoutLogs.date, from ?? addDays(user.today, -90)),
              lte(t.workoutLogs.date, to ?? user.today),
            ),
          )
          .orderBy(desc(t.workoutLogs.date))
          .limit(60);
        if (!logs.length) return { sessions: [] };
        let exerciseId: string | undefined;
        if (exercise) {
          const lib = await db.select({ id: t.exercises.id, name: t.exercises.name }).from(t.exercises).where(eq(t.exercises.userId, user.id));
          exerciseId = bestMatch(lib, exercise)?.id;
          if (!exerciseId) return { error: "Exercise not found" };
        }
        const sets = await db
          .select({ s: t.setLogs, name: t.exercises.name })
          .from(t.setLogs)
          .innerJoin(t.exercises, eq(t.exercises.id, t.setLogs.exerciseId))
          .where(
            and(
              inArray(t.setLogs.workoutLogId, logs.map((l) => l.id)),
              exerciseId ? eq(t.setLogs.exerciseId, exerciseId) : undefined,
            ),
          )
          .orderBy(asc(t.setLogs.exerciseOrder), asc(t.setLogs.setIndex));
        const sessions = logs
          .map((l) => {
            const mine = sets.filter((x) => x.s.workoutLogId === l.id);
            const byEx = new Map<string, string[]>();
            for (const x of mine) {
              const list = byEx.get(x.name) ?? [];
              list.push(`${x.s.warmup ? "wu " : ""}${x.s.weightKg ?? "?"}kg×${x.s.reps ?? "?"}`);
              byEx.set(x.name, list);
            }
            return {
              date: l.date,
              session: l.name,
              status: l.status,
              skipReason: l.skipReason,
              exercises: Object.fromEntries(byEx),
            };
          })
          .filter((s) => !exerciseId || Object.keys(s.exercises).length)
          .slice(0, limit);
        return { sessions };
      },
    }),

    get_nutrition: tool({
      description: "Daily food totals (kcal, protein, carbs, fat) and water for a date range, plus the active diet plan targets.",
      inputSchema: z.object({ from: DateArg, to: DateArg }),
      execute: async ({ from, to }) => {
        const f = from ?? addDays(user.today, -6);
        const tt = to ?? user.today;
        const [meals, water, plan] = await Promise.all([
          db
            .select({
              date: t.mealLogs.date,
              kcal: sql<number>`sum(${t.mealLogs.calories})`,
              protein: sql<number>`sum(${t.mealLogs.proteinG})`,
              carbs: sql<number>`sum(${t.mealLogs.carbsG})`,
              fat: sql<number>`sum(${t.mealLogs.fatG})`,
            })
            .from(t.mealLogs)
            .where(and(eq(t.mealLogs.userId, user.id), gte(t.mealLogs.date, f), lte(t.mealLogs.date, tt)))
            .groupBy(t.mealLogs.date),
          db
            .select({ date: t.dailyLogs.date, waterMl: t.dailyLogs.waterMl, steps: t.dailyLogs.steps, sleep: t.dailyLogs.sleepHours })
            .from(t.dailyLogs)
            .where(and(eq(t.dailyLogs.userId, user.id), gte(t.dailyLogs.date, f), lte(t.dailyLogs.date, tt))),
          activePlan(user.id),
        ]);
        return { days: meals, daily: water, targets: plan };
      },
    }),

    get_body: tool({
      description: "Body weight / body fat / waist entries for a date range.",
      inputSchema: z.object({ from: DateArg, to: DateArg }),
      execute: async ({ from, to }) =>
        db
          .select({ date: t.bodyMetrics.date, weightKg: t.bodyMetrics.weightKg, bodyFatPct: t.bodyMetrics.bodyFatPct, waistCm: t.bodyMetrics.waistCm })
          .from(t.bodyMetrics)
          .where(and(eq(t.bodyMetrics.userId, user.id), gte(t.bodyMetrics.date, from ?? addDays(user.today, -90)), lte(t.bodyMetrics.date, to ?? user.today)))
          .orderBy(asc(t.bodyMetrics.date)),
    }),

    get_focus: tool({
      description: "Focus sessions in a date range: minutes, quality, energy, per goal.",
      inputSchema: z.object({ from: DateArg, to: DateArg }),
      execute: async ({ from, to }) =>
        db
          .select({
            date: t.focusSessions.date,
            label: t.focusSessions.label,
            focusedMin: t.focusSessions.focusedMin,
            quality: t.focusSessions.quality,
            energy: t.focusSessions.energy,
            goal: t.goals.title,
          })
          .from(t.focusSessions)
          .leftJoin(t.goals, eq(t.goals.id, t.focusSessions.goalId))
          .where(and(eq(t.focusSessions.userId, user.id), gte(t.focusSessions.date, from ?? addDays(user.today, -6)), lte(t.focusSessions.date, to ?? user.today)))
          .orderBy(asc(t.focusSessions.startedAt)),
    }),
  };
}

async function findGoal(userId: string, query: string) {
  const season = await getActiveSeason(userId);
  if (!season) return undefined;
  const goals = await db
    .select({ id: t.goals.id, name: t.goals.title, title: t.goals.title })
    .from(t.goals)
    .where(eq(t.goals.seasonId, season.id));
  return bestMatch(goals, query);
}

export async function activePlan(userId: string) {
  return db
    .select({
      name: t.dietPlans.name,
      calories: t.dietPlans.calories,
      proteinG: t.dietPlans.proteinG,
      carbsG: t.dietPlans.carbsG,
      fatG: t.dietPlans.fatG,
      waterMl: t.dietPlans.waterMl,
    })
    .from(t.dietPlans)
    .where(and(eq(t.dietPlans.userId, userId), eq(t.dietPlans.active, true)))
    .get();
}

/** Compact snapshot of one day, used both as a tool and as prompt context. */
export async function dayOverview(user: CurrentUser, d: string) {
  const [blocks, tasks, schedule, logs, meals, daily, focus] = await Promise.all([
    db
      .select({ title: t.blocks.title, kind: t.blocks.kind, start: t.blocks.startMin, end: t.blocks.endMin, done: t.blocks.doneAt, skipped: t.blocks.skippedAt })
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, d)))
      .orderBy(asc(t.blocks.startMin)),
    db
      .select({ title: t.tasks.title, done: t.tasks.doneAt, due: t.tasks.dueDate })
      .from(t.tasks)
      .where(and(eq(t.tasks.userId, user.id), eq(t.tasks.dueDate, d))),
    db
      .select({ label: t.gymSchedule.label, notes: t.gymSchedule.notes, routine: t.workoutTemplates.name, templateId: t.workoutTemplates.id, startMin: t.gymSchedule.startMin })
      .from(t.gymSchedule)
      .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
      .where(and(eq(t.gymSchedule.userId, user.id), eq(t.gymSchedule.weekday, weekday(d))))
      .get(),
    db
      .select({ id: t.workoutLogs.id, name: t.workoutLogs.name, status: t.workoutLogs.status, skipReason: t.workoutLogs.skipReason })
      .from(t.workoutLogs)
      .where(and(eq(t.workoutLogs.userId, user.id), eq(t.workoutLogs.date, d))),
    db
      .select({ name: t.mealLogs.name, kcal: t.mealLogs.calories, protein: t.mealLogs.proteinG })
      .from(t.mealLogs)
      .where(and(eq(t.mealLogs.userId, user.id), eq(t.mealLogs.date, d))),
    db.select().from(t.dailyLogs).where(and(eq(t.dailyLogs.userId, user.id), eq(t.dailyLogs.date, d))).get(),
    db
      .select({ min: sql<number>`coalesce(sum(${t.focusSessions.focusedMin}), 0)` })
      .from(t.focusSessions)
      .where(and(eq(t.focusSessions.userId, user.id), eq(t.focusSessions.date, d)))
      .get(),
  ]);

  let prescription: string[] = [];
  if (schedule?.templateId) {
    const rows = await db
      .select({ name: t.exercises.name, sets: t.templateExercises.sets, reps: t.templateExercises.reps })
      .from(t.templateExercises)
      .innerJoin(t.exercises, eq(t.exercises.id, t.templateExercises.exerciseId))
      .where(eq(t.templateExercises.templateId, schedule.templateId))
      .orderBy(asc(t.templateExercises.sortOrder));
    prescription = rows.map((r) => `${r.name} ${r.sets}×${r.reps}`);
  }

  return {
    date: d,
    calendar: blocks.map((b) => `${formatMin(b.start, true)}–${formatMin(b.end, true)} ${b.title} (${b.kind})${b.done ? " ✓" : b.skipped ? " skipped" : ""}`),
    tasks: tasks.map((x) => `${x.done ? "[x]" : "[ ]"} ${x.title}`),
    training: {
      scheduled: schedule?.routine ?? schedule?.label ?? "Nothing scheduled",
      notes: schedule?.notes ?? undefined,
      prescription,
      logged: logs.map((l) => `${l.name}: ${l.status}${l.skipReason ? ` (${l.skipReason})` : ""}`),
    },
    food: {
      meals: meals.map((m) => `${m.name} ${m.kcal} kcal ${m.protein}g P`),
      kcal: meals.reduce((s, m) => s + m.kcal, 0),
      protein: meals.reduce((s, m) => s + m.protein, 0),
    },
    waterMl: daily?.waterMl ?? 0,
    steps: daily?.steps ?? null,
    sleepHours: daily?.sleepHours ?? null,
    focusMin: focus?.min ?? 0,
  };
}
