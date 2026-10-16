import "server-only";
import { tool } from "ai";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { GOAL_AREAS, GOAL_STATUSES, GOAL_TIERS, type AiAction } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import type { ActionSink } from "./run";
import { getGoalHealth, getPlanStrength } from "@/lib/coach";
import { PALETTE } from "@/lib/colors";
import { addDays, formatMin, isValidISODate, parseTime, startOfWeek, weekday, WEEKDAY_NAMES } from "@/lib/dates";
import { getActiveSeason, seasonEndFor, seasonProgress } from "@/lib/queries";
import { findFreeSlot } from "@/lib/schedule";
import { bestMatch } from "./match";

/*
 * GPS tools: seasons, goals, milestones, weekly steps, time blocks and the
 * weekly gym split. Every write records undo info in `actions`.
 */

const DateArg = z.string().describe("YYYY-MM-DD").optional();
const Time = z.string().describe("HH:MM, 24h");

const GoalInput = z.object({
  title: z.string().describe("Short, concrete goal, e.g. 'Ship v2 of the app'"),
  outcome: z.string().describe("What has happened by the season's end date").optional(),
  why: z.string().optional(),
  tier: z.enum(GOAL_TIERS).describe("core = most important (max 3), secondary = next, support = maintain").default("core"),
  area: z.enum(GOAL_AREAS).default("work"),
  weeklyHours: z.number().min(0).max(60).describe("Hours per week this goal gets on the calendar").default(3),
  system: z.string().describe("The recurring trigger, e.g. 'Mon/Wed/Fri 7am, phone in another room'").optional(),
  color: z.enum(PALETTE).optional(),
  milestones: z.array(z.object({ title: z.string(), dueDate: DateArg })).default([]),
});

const BlockInput = z.object({
  title: z.string(),
  date: DateArg,
  start: Time,
  end: Time,
  kind: z.enum(["focus", "meeting", "workout", "meal", "life", "admin"]).default("focus"),
  goal: z.string().describe("Goal title, fuzzy").optional(),
});

export function buildGpsTools(user: CurrentUser, actions: ActionSink) {
  const push = (a: AiAction) => actions.push(a);

  async function season() {
    return getActiveSeason(user.id);
  }
  async function seasonGoals(seasonId: string) {
    return db
      .select({ id: t.goals.id, name: t.goals.title, color: t.goals.color, status: t.goals.status })
      .from(t.goals)
      .where(and(eq(t.goals.seasonId, seasonId), isNull(t.goals.completedAt)));
  }
  async function goalByTitle(query?: string) {
    if (!query) return undefined;
    const s = await season();
    if (!s) return undefined;
    return bestMatch(await seasonGoals(s.id), query);
  }

  function goalRows(seasonId: string, goals: z.infer<typeof GoalInput>[], used: string[], start = 0) {
    return goals.map((g, i) => {
      const color = g.color ?? PALETTE.find((c) => !used.includes(c) && c !== "slate") ?? "coral";
      used.push(color);
      return {
        id: crypto.randomUUID(),
        userId: user.id,
        seasonId,
        title: g.title.slice(0, 200),
        outcome: g.outcome ?? null,
        why: g.why ?? null,
        tier: g.tier,
        area: g.area,
        color,
        weeklyHours: g.weeklyHours,
        system: g.system ?? null,
        sortOrder: start + i,
      };
    });
  }

  function milestoneRows(goals: z.infer<typeof GoalInput>[], rows: { id: string }[]) {
    return goals.flatMap((g, i) =>
      g.milestones.map((m, j) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        goalId: rows[i].id,
        title: m.title.slice(0, 200),
        dueDate: m.dueDate && isValidISODate(m.dueDate) ? m.dueDate : null,
        sortOrder: j,
      })),
    );
  }

  return {
    get_plan: tool({
      description:
        "The GPS picture: active season (day X of 84, capacity), each goal's tier, weekly hours target, coach status with reasons, this week's planned/done/focus minutes, weekly steps, milestones, plus plan strength. Call before planning or answering 'how am I doing'.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await season();
        if (!s) return { season: null, hint: "No active season. Offer to create one." };
        const health = await getGoalHealth(user.id, user.today);
        const [strength, milestones] = await Promise.all([
          getPlanStrength(user.id, s.id, health),
          db
            .select({ goalId: t.milestones.goalId, title: t.milestones.title, due: t.milestones.dueDate, done: t.milestones.doneAt })
            .from(t.milestones)
            .where(eq(t.milestones.userId, user.id))
            .orderBy(asc(t.milestones.dueDate)),
        ]);
        const p = seasonProgress(s, user.today);
        return {
          season: { name: s.name, intention: s.intention, start: s.startDate, end: s.endDate, day: p.day, of: p.total, week: p.week, capacityHoursPerWeek: s.weeklyCapacityHours },
          planStrength: strength,
          goals: health.map((h) => ({
            title: h.goal.title,
            tier: h.goal.tier,
            area: h.goal.area,
            outcome: h.goal.outcome,
            system: h.goal.system,
            weeklyHoursTarget: h.goal.weeklyHours,
            status: h.autoStatus,
            reasons: h.reasons,
            thisWeek: { plannedMin: h.week.plannedMin, doneMin: h.week.doneMin, focusMin: h.week.focusMin, moved: h.week.rescheduleCount, steps: `${h.week.stepsDone}/${h.week.stepsTotal}` },
            milestones: milestones.filter((m) => m.goalId === h.goal.id).map((m) => `${m.done ? "[x]" : "[ ]"} ${m.title}${m.due ? ` (${m.due})` : ""}`),
            suggestion: h.recommendation?.label,
          })),
        };
      },
    }),

    get_week: tool({
      description:
        "Calendar for a week (Mon–Sun): blocks per day, gym schedule, open weekly steps, and free time windows. Use before drafting or changing a week plan.",
      inputSchema: z.object({ weekStart: DateArg }),
      execute: async ({ weekStart }) => {
        const ws = startOfWeek(weekStart && isValidISODate(weekStart) ? weekStart : user.today);
        const [blocks, gym, steps] = await Promise.all([
          db
            .select({ id: t.blocks.id, title: t.blocks.title, kind: t.blocks.kind, date: t.blocks.date, start: t.blocks.startMin, end: t.blocks.endMin, goalId: t.blocks.goalId, done: t.blocks.doneAt })
            .from(t.blocks)
            .where(and(eq(t.blocks.userId, user.id), gte(t.blocks.date, ws), lte(t.blocks.date, addDays(ws, 6))))
            .orderBy(asc(t.blocks.date), asc(t.blocks.startMin)),
          db
            .select({ weekday: t.gymSchedule.weekday, routine: t.workoutTemplates.name, label: t.gymSchedule.label, start: t.gymSchedule.startMin, duration: t.gymSchedule.durationMin })
            .from(t.gymSchedule)
            .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
            .where(eq(t.gymSchedule.userId, user.id)),
          db
            .select({ title: t.tasks.title, goal: t.goals.title, done: t.tasks.doneAt })
            .from(t.tasks)
            .leftJoin(t.goals, eq(t.goals.id, t.tasks.goalId))
            .where(and(eq(t.tasks.userId, user.id), eq(t.tasks.weekStart, ws))),
        ]);
        const goals = new Map((await db.select({ id: t.goals.id, title: t.goals.title }).from(t.goals).where(eq(t.goals.userId, user.id))).map((g) => [g.id, g.title]));
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = addDays(ws, i);
          const dayBlocks = blocks.filter((b) => b.date === d);
          const g = gym.find((x) => x.weekday === i);
          const busy = dayBlocks.map((b) => ({ startMin: b.start, endMin: b.end }));
          if (g?.routine && g.start != null && !dayBlocks.some((b) => b.kind === "workout")) busy.push({ startMin: g.start, endMin: g.start + (g.duration ?? 60) });
          const free: string[] = [];
          let cursor = user.dayStartMin;
          for (const b of [...busy].sort((a, b) => a.startMin - b.startMin)) {
            if (b.startMin - cursor >= 45) free.push(`${formatMin(cursor, true)}–${formatMin(b.startMin, true)}`);
            cursor = Math.max(cursor, b.endMin);
          }
          if (user.dayEndMin - cursor >= 45) free.push(`${formatMin(cursor, true)}–${formatMin(user.dayEndMin, true)}`);
          return {
            date: d,
            day: WEEKDAY_NAMES[i],
            past: d < user.today,
            gym: g ? (g.routine ? `${g.routine}${g.start != null ? ` at ${formatMin(g.start, true)}` : ""}` : g.label) : null,
            blocks: dayBlocks.map((b) => `${formatMin(b.start, true)}–${formatMin(b.end, true)} ${b.title}${b.goalId ? ` [${goals.get(b.goalId)}]` : ""}${b.done ? " ✓" : ""}`),
            free,
          };
        });
        return { weekStart: ws, dayHours: `${formatMin(user.dayStartMin, true)}–${formatMin(user.dayEndMin, true)}`, days, weeklySteps: steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.title}${s.goal ? ` [${s.goal}]` : ""}`) };
      },
    }),

    create_season: tool({
      description:
        "Start a new 12-week season (84 days) with its goals and milestones. Archives the current season. Only when the user asks for a new season or has none.",
      inputSchema: z.object({
        name: z.string().describe("e.g. 'Autumn 2026'"),
        intention: z.string().describe("One sentence: what this season is about").optional(),
        startDate: DateArg,
        weeklyCapacityHours: z.number().int().min(1).max(80).describe("Hours per week available for goal work").default(15),
        goals: z.array(GoalInput).max(8),
      }),
      execute: async (x) => {
        const prev = await season();
        const id = crypto.randomUUID();
        const start = x.startDate && isValidISODate(x.startDate) ? x.startDate : user.today;
        const goals = goalRows(id, x.goals, []);
        const ms = milestoneRows(x.goals, goals);
        await db.batch([
          db.update(t.seasons).set({ status: "archived" }).where(and(eq(t.seasons.userId, user.id), eq(t.seasons.status, "active"))),
          db.insert(t.seasons).values({ id, userId: user.id, name: x.name, intention: x.intention ?? null, startDate: start, endDate: seasonEndFor(start), weeklyCapacityHours: x.weeklyCapacityHours }),
          ...(goals.length ? [db.insert(t.goals).values(goals)] : []),
          ...(ms.length ? [db.insert(t.milestones).values(ms)] : []),
        ]);
        push({ table: "seasons", id: `${id}|${prev?.id ?? ""}`, label: `Season: ${x.name} · ${goals.length} goals`, icon: "target" });
        return { ok: true, season: x.name, start, end: seasonEndFor(start), goals: goals.map((g) => g.title) };
      },
    }),

    add_goals: tool({
      description: "Add goals (with optional milestones) to the active season.",
      inputSchema: z.object({ goals: z.array(GoalInput).min(1).max(8) }),
      execute: async ({ goals }) => {
        const s = await season();
        if (!s) return { ok: false, error: "No active season. Create one first." };
        const existing = await seasonGoals(s.id);
        const rows = goalRows(s.id, goals, existing.map((g) => g.color), existing.length);
        const ms = milestoneRows(goals, rows);
        await db.batch([db.insert(t.goals).values(rows), ...(ms.length ? [db.insert(t.milestones).values(ms)] : [])]);
        rows.forEach((g) => push({ table: "goals", id: g.id, label: `Goal: ${g.title} · ${g.tier} · ${g.weeklyHours}h/wk`, icon: "target" }));
        return { ok: true, added: rows.map((g) => g.title) };
      },
    }),

    update_goal: tool({
      description: "Edit a goal (title, outcome, tier, weekly hours, system…), mark it complete, or record a check-in status (on_track/adjust/off_track) with a note.",
      inputSchema: z.object({
        goal: z.string().describe("Goal title, fuzzy"),
        title: z.string().optional(),
        outcome: z.string().optional(),
        why: z.string().optional(),
        tier: z.enum(GOAL_TIERS).optional(),
        area: z.enum(GOAL_AREAS).optional(),
        weeklyHours: z.number().min(0).max(60).optional(),
        system: z.string().optional(),
        complete: z.boolean().optional(),
        checkIn: z.object({ status: z.enum(GOAL_STATUSES), confidence: z.number().int().min(0).max(100).optional(), note: z.string().optional() }).optional(),
      }),
      execute: async ({ goal, checkIn, complete, ...fields }) => {
        const g = await goalByTitle(goal);
        if (!g) return { ok: false, error: "Goal not found" };
        const prev = await db.select().from(t.goals).where(eq(t.goals.id, g.id)).get();
        const set: Partial<typeof t.goals.$inferInsert> = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
        if (complete !== undefined) set.completedAt = complete ? Date.now() : null;
        if (checkIn) set.status = checkIn.status;
        if (Object.keys(set).length) {
          await db.update(t.goals).set(set).where(eq(t.goals.id, g.id));
          const before = Object.fromEntries(Object.keys(set).map((k) => [k, prev?.[k as keyof typeof prev] ?? null]));
          push({ table: "goal_update_fields", id: `${g.id}|${JSON.stringify(before)}`, label: complete ? `Completed: ${g.name}` : `Updated: ${g.name}`, icon: "target" });
        }
        if (checkIn) {
          const id = crypto.randomUUID();
          await db.insert(t.goalUpdates).values({ id, userId: user.id, goalId: g.id, date: user.today, weekStart: startOfWeek(user.today), status: checkIn.status, confidence: checkIn.confidence ?? null, note: checkIn.note ?? null });
          push({ table: "goal_updates", id, label: `Check-in: ${g.name} · ${checkIn.status.replace("_", " ")}`, icon: "check" });
        }
        return { ok: true };
      },
    }),

    add_milestones: tool({
      description: "Add dated milestones to a goal.",
      inputSchema: z.object({ goal: z.string(), milestones: z.array(z.object({ title: z.string(), dueDate: DateArg })).min(1) }),
      execute: async ({ goal, milestones }) => {
        const g = await goalByTitle(goal);
        if (!g) return { ok: false, error: "Goal not found" };
        const rows = milestones.map((m, i) => ({ id: crypto.randomUUID(), userId: user.id, goalId: g.id, title: m.title, dueDate: m.dueDate && isValidISODate(m.dueDate) ? m.dueDate : null, sortOrder: 100 + i }));
        await db.insert(t.milestones).values(rows);
        rows.forEach((m) => push({ table: "milestones", id: m.id, label: `Milestone: ${m.title}${m.dueDate ? ` · ${m.dueDate}` : ""}`, icon: "flag" }));
        return { ok: true };
      },
    }),

    complete_milestone: tool({
      description: "Mark a milestone done.",
      inputSchema: z.object({ title: z.string() }),
      execute: async ({ title }) => {
        const open = await db.select({ id: t.milestones.id, name: t.milestones.title }).from(t.milestones).where(and(eq(t.milestones.userId, user.id), isNull(t.milestones.doneAt)));
        const m = bestMatch(open, title);
        if (!m) return { ok: false, error: "Milestone not found" };
        await db.update(t.milestones).set({ doneAt: Date.now() }).where(eq(t.milestones.id, m.id));
        push({ table: "milestone_done", id: m.id, label: `Milestone done: ${m.name}`, icon: "flag" });
        return { ok: true };
      },
    }),

    add_weekly_steps: tool({
      description: "Add this week's small next actions ('weekly steps') for goals. Every goal should have at least one each week.",
      inputSchema: z.object({
        weekStart: DateArg,
        steps: z.array(z.object({ goal: z.string(), title: z.string(), dueDate: DateArg })).min(1),
      }),
      execute: async ({ weekStart, steps }) => {
        const ws = startOfWeek(weekStart && isValidISODate(weekStart) ? weekStart : user.today);
        const rows = [];
        for (const s of steps) {
          const g = await goalByTitle(s.goal);
          rows.push({ id: crypto.randomUUID(), userId: user.id, goalId: g?.id ?? null, title: s.title, weekStart: ws, dueDate: s.dueDate && isValidISODate(s.dueDate) ? s.dueDate : null });
        }
        await db.insert(t.tasks).values(rows);
        rows.forEach((r) => push({ table: "tasks", id: r.id, label: `Weekly step: ${r.title}`, icon: "task" }));
        return { ok: true };
      },
    }),

    add_blocks: tool({
      description:
        "Put one or many time blocks on the calendar in one call (use this to draft a whole week). Tie focus blocks to goals. Never overlap existing blocks or the gym slot; check get_week first when planning.",
      inputSchema: z.object({ blocks: z.array(BlockInput).min(1).max(40) }),
      execute: async ({ blocks }) => {
        const s = await season();
        const goals = s ? await seasonGoals(s.id) : [];
        const rows = [];
        const skipped: string[] = [];
        for (const b of blocks) {
          const start = parseTime(b.start);
          const end = parseTime(b.end);
          if (start == null || end == null || end <= start) {
            skipped.push(b.title);
            continue;
          }
          rows.push({ id: crypto.randomUUID(), userId: user.id, title: b.title.slice(0, 120), kind: b.kind, goalId: (b.goal && bestMatch(goals, b.goal)?.id) || null, date: b.date && isValidISODate(b.date) ? b.date : user.today, startMin: start, endMin: end });
        }
        if (rows.length) await db.insert(t.blocks).values(rows);
        rows.forEach((r) => push({ table: "blocks", id: r.id, label: `${r.title} · ${r.date === user.today ? "today" : WEEKDAY_NAMES[weekday(r.date)].slice(0, 3)} ${formatMin(r.startMin, true)}–${formatMin(r.endMin, true)}`, icon: "calendar" }));
        return { ok: true, added: rows.length, skipped };
      },
    }),

    move_block: tool({
      description: "Move (reschedule) an existing block, found by title and optionally its current date.",
      inputSchema: z.object({ title: z.string(), fromDate: DateArg, toDate: DateArg, start: Time }),
      execute: async ({ title, fromDate, toDate, start }) => {
        const from = fromDate && isValidISODate(fromDate) ? fromDate : user.today;
        const candidates = await db
          .select({ id: t.blocks.id, name: t.blocks.title, date: t.blocks.date, startMin: t.blocks.startMin, endMin: t.blocks.endMin, rescheduleCount: t.blocks.rescheduleCount })
          .from(t.blocks)
          .where(and(eq(t.blocks.userId, user.id), gte(t.blocks.date, from), lte(t.blocks.date, addDays(from, 6))));
        const b = bestMatch(candidates.filter((c) => c.date === from).concat(candidates), title);
        const s = parseTime(start);
        if (!b || s == null) return { ok: false, error: "Block not found" };
        const to = toDate && isValidISODate(toDate) ? toDate : b.date;
        await db.update(t.blocks).set({ date: to, startMin: s, endMin: Math.min(1440, s + (b.endMin - b.startMin)), rescheduleCount: b.rescheduleCount + 1 }).where(eq(t.blocks.id, b.id));
        push({ table: "block_move", id: `${b.id}|${JSON.stringify({ date: b.date, startMin: b.startMin, endMin: b.endMin, rescheduleCount: b.rescheduleCount })}`, label: `Moved ${b.name} → ${to === user.today ? "today" : to} ${formatMin(s, true)}`, icon: "calendar" });
        return { ok: true };
      },
    }),

    protect_time: tool({
      description: "Protect a focus block for a goal in the first free slot of a day (mornings first). Use when a goal is drifting.",
      inputSchema: z.object({ goal: z.string(), minutes: z.number().int().min(30).max(240).default(120), date: DateArg }),
      execute: async ({ goal, minutes, date }) => {
        const g = await goalByTitle(goal);
        if (!g) return { ok: false, error: "Goal not found" };
        const d = date && isValidISODate(date) ? date : addDays(user.today, 1);
        const busy = await db.select({ startMin: t.blocks.startMin, endMin: t.blocks.endMin }).from(t.blocks).where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, d)));
        const slot = findFreeSlot(busy, minutes, Math.max(user.dayStartMin, 8 * 60), Math.min(user.dayEndMin, 21 * 60));
        if (!slot) return { ok: false, error: "No free slot that day" };
        const id = crypto.randomUUID();
        await db.insert(t.blocks).values({ id, userId: user.id, goalId: g.id, title: `Deep work: ${g.name}`, kind: "focus", date: d, startMin: slot.start, endMin: slot.end, protected: true });
        push({ table: "blocks", id, label: `Protected ${g.name} · ${d === user.today ? "today" : WEEKDAY_NAMES[weekday(d)].slice(0, 3)} ${formatMin(slot.start, true)}–${formatMin(slot.end, true)}`, icon: "shield" });
        return { ok: true };
      },
    }),

    set_gym_day: tool({
      description: "Change the weekly gym split for a weekday: a routine (by name) or a rest/label day, with optional time.",
      inputSchema: z.object({
        weekday: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
        routine: z.string().describe("Routine name like 'Push A'. Omit for a rest/label day.").optional(),
        label: z.string().describe("For non-routine days, e.g. 'Rest / easy walking'").optional(),
        time: Time.optional(),
        notes: z.string().optional(),
      }),
      execute: async (x) => {
        const wd = WEEKDAY_NAMES.indexOf(x.weekday);
        const routines = await db.select({ id: t.workoutTemplates.id, name: t.workoutTemplates.name, estimatedMin: t.workoutTemplates.estimatedMin }).from(t.workoutTemplates).where(eq(t.workoutTemplates.userId, user.id));
        const r = x.routine ? bestMatch(routines, x.routine) : undefined;
        if (x.routine && !r) return { ok: false, error: `No routine named ${x.routine}`, routines: routines.map((r) => r.name) };
        const prev = await db.select().from(t.gymSchedule).where(and(eq(t.gymSchedule.userId, user.id), eq(t.gymSchedule.weekday, wd))).get();
        const values = { templateId: r?.id ?? null, label: r ? null : (x.label ?? "Rest"), startMin: parseTime(x.time) ?? (r ? (prev?.startMin ?? null) : null), notes: x.notes ?? (r ? null : (prev?.notes ?? null)), durationMin: r?.estimatedMin ?? 30 };
        await db
          .insert(t.gymSchedule)
          .values({ userId: user.id, weekday: wd, ...values })
          .onConflictDoUpdate({ target: [t.gymSchedule.userId, t.gymSchedule.weekday], set: values });
        push({
          table: "gym_day",
          id: `${wd}|${JSON.stringify(prev ? { templateId: prev.templateId, label: prev.label, startMin: prev.startMin, notes: prev.notes, durationMin: prev.durationMin } : null)}`,
          label: `${x.weekday}: ${r?.name ?? values.label}${values.startMin != null ? ` at ${formatMin(values.startMin, true)}` : ""}`,
          icon: "dumbbell",
        });
        return { ok: true };
      },
    }),

    log_reflection: tool({
      description: "Save today's evening reflection (what moved, what slipped, tomorrow's one thing, mood/energy 1-5).",
      inputSchema: z.object({
        wins: z.string().optional(),
        slipped: z.string().optional(),
        next: z.string().optional(),
        mood: z.number().int().min(1).max(5).optional(),
        energy: z.number().int().min(1).max(5).optional(),
      }),
      execute: async (r) => {
        const set = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
        await db
          .insert(t.reflections)
          .values({ userId: user.id, kind: "daily", date: user.today, ...set })
          .onConflictDoUpdate({ target: [t.reflections.userId, t.reflections.kind, t.reflections.date], set });
        push({ table: "noop", id: user.today, label: "Reflection saved", icon: "check" });
        return { ok: true };
      },
    }),
  };
}

/** Undo statements for GPS actions (used by undoCommand). */
export function gpsUndo(a: AiAction, userId: string) {
  const sep = a.id.indexOf("|");
  const head = sep === -1 ? a.id : a.id.slice(0, sep);
  const tail = sep === -1 ? "" : a.id.slice(sep + 1);
  switch (a.table) {
    case "seasons":
      return [
        db.delete(t.seasons).where(and(eq(t.seasons.id, head), eq(t.seasons.userId, userId))),
        ...(tail ? [db.update(t.seasons).set({ status: "active" }).where(and(eq(t.seasons.id, tail), eq(t.seasons.userId, userId)))] : []),
      ];
    case "goals":
      return [db.delete(t.goals).where(and(eq(t.goals.id, head), eq(t.goals.userId, userId)))];
    case "goal_update_fields":
      return [db.update(t.goals).set(JSON.parse(tail)).where(and(eq(t.goals.id, head), eq(t.goals.userId, userId)))];
    case "goal_updates":
      return [db.delete(t.goalUpdates).where(and(eq(t.goalUpdates.id, head), eq(t.goalUpdates.userId, userId)))];
    case "milestones":
      return [db.delete(t.milestones).where(and(eq(t.milestones.id, head), eq(t.milestones.userId, userId)))];
    case "milestone_done":
      return [db.update(t.milestones).set({ doneAt: null }).where(and(eq(t.milestones.id, head), eq(t.milestones.userId, userId)))];
    case "block_move":
      return [db.update(t.blocks).set(JSON.parse(tail)).where(and(eq(t.blocks.id, head), eq(t.blocks.userId, userId)))];
    case "gym_day": {
      const prev = JSON.parse(tail);
      const where = and(eq(t.gymSchedule.userId, userId), eq(t.gymSchedule.weekday, Number(head)));
      return [prev ? db.update(t.gymSchedule).set(prev).where(where) : db.delete(t.gymSchedule).where(where)];
    }
    default:
      return [];
  }
}

