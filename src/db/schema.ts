import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * Conventions
 * - ids are text (crypto.randomUUID)
 * - calendar days are stored as "YYYY-MM-DD" text in the user's timezone
 * - times of day are stored as minutes from midnight (0..1439)
 * - instants are stored as unix milliseconds
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "number" })
    .notNull()
    .$defaultFn(() => Date.now());
const userId = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// ───────────────────────────── Auth ─────────────────────────────

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  // first hour of the working day shown in the planner
  dayStartMin: integer("day_start_min").notNull().default(6 * 60),
  dayEndMin: integer("day_end_min").notNull().default(23 * 60),
  // AI command bar: OpenCode model id and reasoning effort
  aiModel: text("ai_model").notNull().default("deepseek-v4.1-flash"),
  aiEffort: text("ai_effort").notNull().default("low"),
  // program-wide training notes, e.g. "Aim for ~2 reps in reserve"
  trainingNotes: text("training_notes"),
  // Appearance: colour theme id (src/lib/themes.ts) and light/dark/system
  theme: text("theme").notNull().default("paper"),
  colorMode: text("color_mode", { enum: ["system", "light", "dark"] }).notNull().default("system"),
  // Which reminders to push (see src/lib/push/types.ts)
  notifyPrefs: text("notify_prefs", { mode: "json" }).$type<NotifyPrefs>(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 of the cookie token
    id: text("id").primaryKey(),
    userId: userId(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─────────────────────── Seasons & goals (GPS) ───────────────────────

export const seasons = sqliteTable(
  "seasons",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    // one sentence: what this season is about
    intention: text("intention"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    // free-form brain dump captured during setup
    brainDump: text("brain_dump"),
    weeklyCapacityHours: integer("weekly_capacity_hours").notNull().default(15),
    createdAt: createdAt(),
  },
  (t) => [index("seasons_user_idx").on(t.userId, t.status)],
);

export const GOAL_TIERS = ["core", "secondary", "support"] as const;
export const GOAL_STATUSES = ["on_track", "adjust", "off_track"] as const;
export const GOAL_AREAS = [
  "work",
  "health",
  "creative",
  "learning",
  "personal",
  "money",
] as const;

export const goals = sqliteTable(
  "goals",
  {
    id: id(),
    userId: userId(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Goal: what does "done" look like at the end of the season
    outcome: text("outcome"),
    // why this matters
    why: text("why"),
    tier: text("tier", { enum: GOAL_TIERS }).notNull().default("core"),
    area: text("area", { enum: GOAL_AREAS }).notNull().default("work"),
    color: text("color").notNull().default("coral"),
    weeklyHours: real("weekly_hours").notNull().default(3),
    // System: the recurring trigger, e.g. "Mon/Wed/Fri 7am after coffee"
    system: text("system"),
    // last self-assessed status from a weekly review
    status: text("status", { enum: GOAL_STATUSES })
      .notNull()
      .default("on_track"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: integer("completed_at", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("goals_season_idx").on(t.seasonId)],
);

export const milestones = sqliteTable(
  "milestones",
  {
    id: id(),
    userId: userId(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: text("due_date"),
    doneAt: integer("done_at", { mode: "number" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("milestones_goal_idx").on(t.goalId)],
);

// Trajectory: dated status updates per goal (weekly assessment)
export const goalUpdates = sqliteTable(
  "goal_updates",
  {
    id: id(),
    userId: userId(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    weekStart: text("week_start").notNull(),
    status: text("status", { enum: GOAL_STATUSES }).notNull(),
    // 0-100 confidence of hitting the goal this season
    confidence: integer("confidence"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("goal_updates_goal_idx").on(t.goalId, t.date)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    userId: userId(),
    goalId: text("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    milestoneId: text("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    // a "weekly step": the next action for a goal in a given week
    weekStart: text("week_start"),
    dueDate: text("due_date"),
    dueMin: integer("due_min"),
    estimateMin: integer("estimate_min"),
    doneAt: integer("done_at", { mode: "number" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_user_due_idx").on(t.userId, t.dueDate),
    index("tasks_goal_idx").on(t.goalId),
  ],
);

export const BLOCK_KINDS = [
  "focus",
  "meeting",
  "workout",
  "meal",
  "life",
  "admin",
] as const;

// Time blocks on the calendar
export const blocks = sqliteTable(
  "blocks",
  {
    id: id(),
    userId: userId(),
    goalId: text("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    workoutTemplateId: text("workout_template_id"),
    title: text("title").notNull(),
    kind: text("kind", { enum: BLOCK_KINDS }).notNull().default("focus"),
    date: text("date").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    // drift signal: how many times this block was moved to another time/day
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    protected: integer("protected", { mode: "boolean" })
      .notNull()
      .default(false),
    doneAt: integer("done_at", { mode: "number" }),
    skippedAt: integer("skipped_at", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("blocks_user_date_idx").on(t.userId, t.date)],
);

export const focusSessions = sqliteTable(
  "focus_sessions",
  {
    id: id(),
    userId: userId(),
    goalId: text("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    blockId: text("block_id").references(() => blocks.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    date: text("date").notNull(),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    endedAt: integer("ended_at", { mode: "number" }),
    plannedMin: integer("planned_min").notNull(),
    // minutes actually focused (pauses excluded)
    focusedMin: integer("focused_min").notNull().default(0),
    pauses: integer("pauses").notNull().default(0),
    // self rating 1-5 asked at the end of a session
    rating: integer("rating"),
    // energy after the session: -2 drained … +2 energised
    energy: integer("energy"),
    // computed 0-100 focus quality
    quality: integer("quality"),
    notes: text("notes"),
    blockers: text("blockers"),
    createdAt: createdAt(),
  },
  (t) => [index("focus_user_date_idx").on(t.userId, t.date)],
);

export const reflections = sqliteTable(
  "reflections",
  {
    id: id(),
    userId: userId(),
    kind: text("kind", { enum: ["daily", "weekly"] }).notNull(),
    // the day (daily) or the Monday of the week (weekly)
    date: text("date").notNull(),
    mood: integer("mood"),
    energy: integer("energy"),
    wins: text("wins"),
    slipped: text("slipped"),
    learned: text("learned"),
    next: text("next"),
    // weekly only: what gave / drained energy
    energisers: text("energisers"),
    drainers: text("drainers"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reflections_unique").on(t.userId, t.kind, t.date)],
);

// ─────────────────────────── Fitness ───────────────────────────

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "glutes",
  "core",
  "full_body",
  "cardio",
  "mobility",
] as const;

export const exercises = sqliteTable(
  "exercises",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    muscle: text("muscle", { enum: MUSCLE_GROUPS }).notNull(),
    equipment: text("equipment"),
    // reps-and-weight, reps only, or time/distance for cardio
    type: text("type", { enum: ["weight", "bodyweight", "cardio"] })
      .notNull()
      .default("weight"),
    // how logged weight is meant: total load, per hand (dumbbells) or per arm (cables)
    weightBasis: text("weight_basis", { enum: ["total", "per_hand", "per_arm"] })
      .notNull()
      .default("total"),
    // reps counted per arm/leg
    unilateral: integer("unilateral", { mode: "boolean" }).notNull().default(false),
    cues: text("cues"),
    createdAt: createdAt(),
  },
  (t) => [index("exercises_user_idx").on(t.userId)],
);

// A routine such as "Push day" or "Lower body A"
export const workoutTemplates = sqliteTable(
  "workout_templates",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    focus: text("focus"),
    color: text("color").notNull().default("sky"),
    estimatedMin: integer("estimated_min").notNull().default(60),
    notes: text("notes"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("templates_user_idx").on(t.userId)],
);

export const templateExercises = sqliteTable(
  "template_exercises",
  {
    id: id(),
    templateId: text("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    sets: integer("sets").notNull().default(3),
    repsMin: integer("reps_min"),
    repsMax: integer("reps_max"),
    // display label, e.g. "8-12", "AMRAP", "20-40 min"
    reps: text("reps").notNull().default("8-12"),
    // e.g. a prescription still being tested
    provisional: integer("provisional", { mode: "boolean" }).notNull().default(false),
    weightKg: real("weight_kg"),
    restSec: integer("rest_sec").notNull().default(90),
    notes: text("notes"),
  },
  (t) => [index("template_ex_template_idx").on(t.templateId)],
);

// The weekly gym split: what happens on each weekday
export const gymSchedule = sqliteTable(
  "gym_schedule",
  {
    id: id(),
    userId: userId(),
    // 0 = Monday … 6 = Sunday
    weekday: integer("weekday").notNull(),
    templateId: text("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    // label for non-template days, e.g. "Rest", "Easy cardio or full rest"
    label: text("label"),
    // e.g. "Walking, cycling or full rest · 20-40 min · conversational pace"
    notes: text("notes"),
    startMin: integer("start_min"),
    durationMin: integer("duration_min").notNull().default(60),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("gym_schedule_unique").on(t.userId, t.weekday)],
);

// Saved gym programs (a whole split: routines + weekly schedule + notes) the
// user can load in one tap. Built-in presets live in src/lib/gym-presets.ts.
export const gymPrograms = sqliteTable(
  "gym_programs",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    description: text("description"),
    data: text("data", { mode: "json" }).$type<import("@/lib/gym-presets").ProgramData>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("gym_programs_user_idx").on(t.userId)],
);

export const workoutLogs = sqliteTable(
  "workout_logs",
  {
    id: id(),
    userId: userId(),
    templateId: text("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    // what the schedule said for that day, when a different session was done
    plannedTemplateId: text("planned_template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    date: text("date").notNull(),
    // in_progress while logging; completed; skipped (with reason); unlogged =
    // reported done but sets unknown
    status: text("status", { enum: ["in_progress", "completed", "skipped", "unlogged"] })
      .notNull()
      .default("in_progress"),
    skipReason: text("skip_reason"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    endedAt: integer("ended_at", { mode: "number" }),
    // how it felt 1-5
    feeling: integer("feeling"),
    notes: text("notes"),
    // cardio summary for non-lifting sessions
    cardioMin: integer("cardio_min"),
    distanceKm: real("distance_km"),
    createdAt: createdAt(),
  },
  (t) => [index("workout_logs_user_date_idx").on(t.userId, t.date)],
);

export const setLogs = sqliteTable(
  "set_logs",
  {
    id: id(),
    workoutLogId: text("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    exerciseOrder: integer("exercise_order").notNull().default(0),
    setIndex: integer("set_index").notNull(),
    warmup: integer("warmup", { mode: "boolean" }).notNull().default(false),
    reps: integer("reps"),
    // null = unknown
    weightKg: real("weight_kg"),
    note: text("note"),
    durationSec: integer("duration_sec"),
    rpe: real("rpe"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("set_logs_workout_idx").on(t.workoutLogId)],
);

export const bodyMetrics = sqliteTable(
  "body_metrics",
  {
    id: id(),
    userId: userId(),
    date: text("date").notNull(),
    weightKg: real("weight_kg"),
    bodyFatPct: real("body_fat_pct"),
    waistCm: real("waist_cm"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("body_metrics_unique").on(t.userId, t.date)],
);

// ─────────────────────────── Nutrition ───────────────────────────

export const DIET_GOALS = ["cut", "maintain", "bulk", "recomp"] as const;

export const dietPlans = sqliteTable(
  "diet_plans",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    goal: text("goal", { enum: DIET_GOALS }).notNull().default("maintain"),
    calories: integer("calories").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    waterMl: integer("water_ml").notNull().default(3000),
    description: text("description"),
    // slug of the library plan it was copied from, if any
    source: text("source"),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("diet_plans_user_idx").on(t.userId)],
);

export const dietPlanMeals = sqliteTable(
  "diet_plan_meals",
  {
    id: id(),
    planId: text("plan_id")
      .notNull()
      .references(() => dietPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timeMin: integer("time_min"),
    // what to eat, one item per line
    items: text("items"),
    calories: integer("calories").notNull().default(0),
    proteinG: integer("protein_g").notNull().default(0),
    carbsG: integer("carbs_g").notNull().default(0),
    fatG: integer("fat_g").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("diet_plan_meals_plan_idx").on(t.planId)],
);

export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: id(),
    userId: userId(),
    date: text("date").notNull(),
    planMealId: text("plan_meal_id").references(() => dietPlanMeals.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    calories: integer("calories").notNull().default(0),
    proteinG: integer("protein_g").notNull().default(0),
    carbsG: integer("carbs_g").notNull().default(0),
    fatG: integer("fat_g").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("meal_logs_user_date_idx").on(t.userId, t.date)],
);

// One row per day for simple daily counters
export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    id: id(),
    userId: userId(),
    date: text("date").notNull(),
    waterMl: integer("water_ml").notNull().default(0),
    steps: integer("steps"),
    sleepHours: real("sleep_hours"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("daily_logs_unique").on(t.userId, t.date)],
);

// ─────────────────────────── Custom themes ───────────────────────────

/** Token values for one colour mode of a custom theme (CSS colours). */
export type ThemeTokens = Record<string, string>;

// Themes a user designs and names. The active theme id is users.theme
// ("custom:<id>" for these).
export const userThemes = sqliteTable(
  "user_themes",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    light: text("light", { mode: "json" }).$type<ThemeTokens>().notNull(),
    dark: text("dark", { mode: "json" }).$type<ThemeTokens>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("user_themes_user_idx").on(t.userId)],
);

// ─────────────────────────── Push notifications ───────────────────────────

export type NotifyPrefs = {
  blocks: boolean; // a time block is about to start
  blockLeadMin: number; // how many minutes before
  morning: boolean; // morning coach read
  morningMin: number; // minutes from midnight
  workout: boolean; // gym session reminder
  evening: boolean; // evening reflection
  eveningMin: number;
  weekly: boolean; // Sunday weekly review
  water: boolean; // gentle water nudges
};

// One row per device/browser that allowed notifications (Web Push, VAPID).
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: id(),
    userId: userId(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSentAt: integer("last_sent_at", { mode: "number" }),
  },
  (t) => [index("push_subs_user_idx").on(t.userId)],
);

// Dedupe: each reminder (e.g. "block:<id>", "morning:2026-10-17") is sent once.
export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: id(),
    userId: userId(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    sentAt: integer("sent_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [uniqueIndex("notification_log_unique").on(t.userId, t.key)],
);

// ─────────────────────────── AI commands ───────────────────────────

// Each "tell Timeo" command: what was typed, what the model did, and the rows
// it created (so they can be undone).
export const aiCommands = sqliteTable(
  "ai_commands",
  {
    id: id(),
    userId: userId(),
    input: text("input").notNull(),
    reply: text("reply"),
    model: text("model").notNull(),
    effort: text("effort").notNull(),
    // JSON: [{ kind, table, id, label }]
    actions: text("actions", { mode: "json" }).$type<AiAction[]>().notNull().default([]),
    error: text("error"),
    durationMs: integer("duration_ms"),
    undoneAt: integer("undone_at", { mode: "number" }),
    // background runs: running → done | error
    status: text("status", { enum: ["running", "done", "error"] }).notNull().default("done"),
    // what to render in the history (text, reasoning and tool steps)
    parts: text("parts", { mode: "json" }).$type<AiPart[]>().notNull().default([]),
    // last time an open app looked at this run (decides whether to push)
    seenAt: integer("seen_at", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("ai_commands_user_idx").on(t.userId, t.createdAt)],
);

export type AiAction = { table: string; id: string; label: string; icon?: string };

export type AiPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; name: string; state: "done" | "error"; input?: unknown; output?: unknown; error?: string };

export type User = typeof users.$inferSelect;
export type AiCommand = typeof aiCommands.$inferSelect;
export type UserTheme = typeof userThemes.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type GoalUpdate = typeof goalUpdates.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;
export type Reflection = typeof reflections.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type TemplateExercise = typeof templateExercises.$inferSelect;
export type GymScheduleDay = typeof gymSchedule.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type GymProgram = typeof gymPrograms.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type DietPlan = typeof dietPlans.$inferSelect;
export type DietPlanMeal = typeof dietPlanMeals.$inferSelect;
export type MealLog = typeof mealLogs.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;

