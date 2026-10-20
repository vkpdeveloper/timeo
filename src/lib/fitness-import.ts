// Training importer.
//
// `parseTrainingJson` is a pure parser for the program + log JSON format
// (see the Import screen). `importTraining` writes the parsed result for a user,
// or with `dryRun` only reports what it would do.
//
// Data rules honoured: null = unknown (weights stay null, the reported text goes
// into the set note); unreported / future days are not imported (they are not
// "skipped"); warm-ups are stored separately from working sets; per-hand and
// per-arm weights are stored as reported, never doubled.

import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { MUSCLE_GROUPS } from "@/db/schema";
import { PALETTE } from "@/lib/colors";
import { isValidISODate, WEEKDAY_NAMES, weekday as weekdayOf } from "@/lib/dates";
import { catalogIdFor } from "@/lib/exercise-catalog-server";
import { EXERCISE_LIBRARY, STARTER_ROUTINES, repsLabel } from "@/lib/fitness-library";

type Muscle = (typeof MUSCLE_GROUPS)[number];
type Basis = "total" | "per_hand" | "per_arm";

export type ParsedSet = { warmup: boolean; reps: number | null; weightKg: number | null; note: string | null };
export type ParsedLogExercise = { name: string; weightBasis: Basis | null; unilateral: boolean | null; sets: ParsedSet[] };
export type ParsedLog = {
  date: string;
  name: string;
  plannedName: string | null;
  status: "completed" | "skipped" | "unlogged";
  skipReason: string | null;
  notes: string | null;
  exercises: ParsedLogExercise[];
};
export type ParsedTemplateExercise = {
  name: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  provisional: boolean;
  notes: string | null;
};
export type ParsedDay = {
  weekday: number;
  session: string;
  exercises: ParsedTemplateExercise[];
  notes: string | null;
};
export type ParsedImport = {
  timezone: string | null;
  trainingNotes: string | null;
  days: ParsedDay[];
  logs: ParsedLog[];
  ignoredDays: { date: string; status: string; why: string }[];
  warnings: string[];
};

export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const capFirst = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const sentence = (x: string) => (/[.!?]$/.test(x) ? x : `${x}.`);

function weekdayFromName(name: string): number {
  const i = WEEKDAY_NAMES.findIndex((d) => d.toLowerCase() === name.toLowerCase().trim());
  return i;
}

function parseReps(v: unknown): [number | null, number | null] {
  if (Array.isArray(v)) {
    const a = n(v[0]);
    const b = n(v[1]);
    return [a, b ?? a];
  }
  if (typeof v === "number") return [v, v];
  if (typeof v === "string") {
    const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(v.trim());
    if (m) return [Number(m[1]), Number(m[2])];
    const one = Number(v);
    if (Number.isFinite(one)) return [one, one];
  }
  return [null, null];
}

/** "Skullcrusher OR single-arm cable pushdown" → primary + "Or single-arm cable pushdown." */
function splitAlternatives(name: string): { primary: string; alt: string | null } {
  const parts = name.split(/\s+OR\s+/);
  if (parts.length < 2) return { primary: name.trim(), alt: null };
  return { primary: parts[0].trim(), alt: `Or ${parts.slice(1).map((p) => lowerFirst(p.trim())).join(" or ")}.` };
}

function joinOptions(options: string[]): string {
  const clean = options.map((o, i) => (i === 0 ? capFirst(o) : lowerFirst(o)));
  if (clean.length <= 1) return clean.join("");
  return `${clean.slice(0, -1).join(", ")} or ${clean[clean.length - 1]}`;
}

/** Pure: validates and normalises the JSON. Throws ImportError with a readable message. */
export function parseTrainingJson(input: unknown): ParsedImport {
  let data = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      throw new ImportError("That isn't valid JSON. Paste the whole file, including the outer braces.");
    }
  }
  if (!isObj(data)) throw new ImportError("Expected a JSON object with a schedule and/or log.");
  const warnings: string[] = [];
  const schedule = isObj(data.schedule) ? data.schedule : null;
  const log = isObj(data.log) ? data.log : null;
  if (!schedule && !log) throw new ImportError("Nothing to import: no \"schedule\" or \"log\" found.");

  // ── program ──
  const days: ParsedDay[] = [];
  let trainingNotes: string | null = null;
  if (schedule) {
    const notes = arr(schedule.notes).map(s).filter((x): x is string => !!x);
    trainingNotes = notes.length ? notes.join("\n") : s(schedule.notes);
    for (const [key, value] of Object.entries(schedule)) {
      const wd = weekdayFromName(key);
      if (wd < 0 || !isObj(value)) continue;
      const session = s(value.session) ?? (arr(value.exercises).length ? `${WEEKDAY_NAMES[wd]} session` : "Rest");
      const exercises: ParsedTemplateExercise[] = [];
      for (const e of arr(value.exercises)) {
        if (!isObj(e) || !s(e.name)) continue;
        const { primary, alt } = splitAlternatives(s(e.name)!);
        const [repsMin, repsMax] = parseReps(e.reps);
        const note = [alt, s(e.note) ? sentence(s(e.note)!) : null].filter(Boolean).join(" ") || null;
        exercises.push({
          name: primary,
          sets: Math.max(1, Math.round(n(e.sets) ?? 3)),
          repsMin,
          repsMax,
          provisional: s(e.prescription_status)?.toLowerCase() === "provisional",
          notes: note,
        });
      }
      const extra: string[] = [];
      const options = arr(value.options).map(s).filter((x): x is string => !!x);
      if (options.length) extra.push(joinOptions(options));
      const cm = arr(value.cardio_minutes).map(n).filter((x): x is number => x != null);
      if (cm.length) extra.push(cm.length > 1 ? `${cm[0]}–${cm[1]} min` : `${cm[0]} min`);
      if (s(value.intensity)) extra.push(lowerFirst(s(value.intensity)!));
      if (n(value.working_sets) != null) extra.push(`${n(value.working_sets)} working sets`);
      if (s(value.notes)) extra.push(s(value.notes)!);
      days.push({ weekday: wd, session, exercises, notes: extra.length ? extra.join(" · ") : null });
    }
    days.sort((a, b) => a.weekday - b.weekday);
  }
  const sessionFor = (wd: number) => days.find((d) => d.weekday === wd)?.session ?? null;

  // ── log ──
  const logs: ParsedLog[] = [];
  const ignoredDays: ParsedImport["ignoredDays"] = [];
  for (const d of arr(log?.days)) {
    if (!isObj(d)) continue;
    const date = s(d.date);
    if (!date || !isValidISODate(date)) {
      warnings.push(`Skipped a day with an invalid date (${String(d.date)}).`);
      continue;
    }
    const status = (s(d.status) ?? "").toLowerCase();
    const wd = weekdayOf(date);
    const planned = s(d.planned_session) ?? s(d.scheduled_session) ?? sessionFor(wd);
    const name = s(d.actual_session) ?? s(d.session) ?? planned ?? "Workout";
    const exercisesRaw = d.exercises;

    if (status === "skipped") {
      logs.push({
        date,
        name: planned ?? name,
        plannedName: planned,
        status: "skipped",
        skipReason: s(d.reason) ?? s(d.note),
        notes: s(d.reason) && s(d.note) ? s(d.note) : null,
        exercises: [],
      });
      continue;
    }
    if (status !== "completed") {
      ignoredDays.push({
        date,
        status: status || "unknown",
        why: status === "future" ? "Upcoming" : "Not reported",
      });
      continue;
    }

    const notes: string[] = [];
    if (s(d.note)) notes.push(sentence(s(d.note)!));
    const exercises: ParsedLogExercise[] = [];
    for (const e of arr(exercisesRaw)) {
      if (!isObj(e) || !s(e.name)) continue;
      const exName = splitAlternatives(s(e.name)!).primary;
      const basisRaw = s(e.weight_basis);
      const weightBasis: Basis | null = basisRaw === "per_hand" || basisRaw === "per_arm" || basisRaw === "total" ? basisRaw : null;
      const repsBasis = s(e.reps_basis);
      const sets: ParsedSet[] = [];
      const pushSets = (list: unknown, warmup: boolean) => {
        for (const x of arr(list)) {
          if (!isObj(x)) continue;
          const weightKg = n(x.weight_kg);
          const reported = s(x.weight_as_reported);
          const note = [
            weightKg == null && reported ? `Weight reported as “${reported}”` : null,
            s(x.note),
          ]
            .filter(Boolean)
            .join(". ");
          sets.push({ warmup, reps: n(x.reps) != null ? Math.round(n(x.reps)!) : null, weightKg, note: note || null });
        }
      };
      pushSets(e.warmup_sets, true);
      pushSets(e.working_sets ?? e.sets, false);
      if (s(e.note)) notes.push(`${exName}: ${sentence(s(e.note)!)}`);
      exercises.push({ name: exName, weightBasis, unilateral: repsBasis === "per_arm" || repsBasis === "per_side" ? true : null, sets });
    }
    const walks = arr(d.walking)
      .filter(isObj)
      .map((w) => {
        const bits = [s(w.activity) ?? "Walk"];
        if (n(w.duration_minutes) != null) bits.push(`${n(w.duration_minutes)} min`);
        if (n(w.distance_km) != null) bits.push(`${n(w.distance_km)} km`);
        if (s(w.status) && s(w.status) !== "completed") bits.push(s(w.status)!);
        return bits.join(" ");
      });
    if (walks.length) notes.push(`Walking: ${walks.join(", ")}.`);
    const hasSets = exercises.some((e) => e.sets.length > 0);
    logs.push({
      date,
      name,
      plannedName: planned,
      status: hasSets ? "completed" : "unlogged",
      skipReason: null,
      notes: notes.length ? notes.join("\n") : null,
      exercises: hasSets ? exercises : [],
    });
  }

  return { timezone: s(data.timezone), trainingNotes, days, logs, ignoredDays, warnings };
}

// ───────────────────────────── Writer ─────────────────────────────

function guessMuscle(name: string): Muscle {
  const x = name.toLowerCase();
  const rules: [RegExp, Muscle][] = [
    [/walk|cycl|run|bike|cardio|row(ing)? machine/, "cardio"],
    [/squat|leg|lunge|calf|hamstring|quad/, "legs"],
    [/hip thrust|glute/, "glutes"],
    [/bench|chest|fly|pec|push-?up/, "chest"],
    [/row|pull|lat|deadlift|back/, "back"],
    [/shoulder|lateral|raise|overhead press|face pull|delt/, "shoulders"],
    [/curl|tricep|skull|pushdown|extension|wrist|forearm/, "arms"],
    [/plank|crunch|ab|core/, "core"],
  ];
  return rules.find(([r]) => r.test(x))?.[1] ?? "full_body";
}

function restFor(repsMax: number | null) {
  if (repsMax == null) return 90;
  if (repsMax <= 8) return 180;
  if (repsMax <= 12) return 120;
  if (repsMax <= 15) return 90;
  return 60;
}

/** Unix ms for a local date + minutes in a timezone. */
function zonedMs(date: string, min: number, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(guess));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return guess - (asUTC - guess);
  } catch {
    return guess;
  }
}

export type ImportReport = {
  routines: { name: string; exercises: number; action: "create" | "update" }[];
  schedule: { weekday: number; name: string; routine: boolean }[];
  exercisesCreated: string[];
  logs: { date: string; name: string; status: ParsedLog["status"]; sets: number; action: "create" | "update" }[];
  ignoredDays: ParsedImport["ignoredDays"];
  warnings: string[];
  trainingNotes: boolean;
};

export async function importTraining(userId: string, parsed: ParsedImport, opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const [user, exRows, tplRows, schedRows] = await Promise.all([
    db.select({ timezone: t.users.timezone }).from(t.users).where(eq(t.users.id, userId)).get(),
    db.select().from(t.exercises).where(eq(t.exercises.userId, userId)),
    db.select().from(t.workoutTemplates).where(and(eq(t.workoutTemplates.userId, userId), eq(t.workoutTemplates.archived, false))),
    db.select().from(t.gymSchedule).where(eq(t.gymSchedule.userId, userId)),
  ]);
  const tz = user?.timezone && user.timezone !== "UTC" ? user.timezone : (parsed.timezone ?? "UTC");
  const key = (x: string) => x.trim().toLowerCase();

  // statements to run in one batch; exercise writes go first so later rows can reference them
  const exStmts: unknown[] = [];
  const stmts: unknown[] = [];

  // ── exercises ──
  const exByName = new Map(exRows.map((e) => [key(e.name), e]));
  const created: string[] = [];
  const basisHints = new Map<string, { basis: Basis | null; unilateral: boolean | null }>();
  for (const l of parsed.logs)
    for (const e of l.exercises)
      if (e.weightBasis || e.unilateral) basisHints.set(key(e.name), { basis: e.weightBasis, unilateral: e.unilateral });

  const ensureExercise = (name: string): string => {
    const k = key(name);
    const found = exByName.get(k);
    const hint = basisHints.get(k);
    if (found) {
      const patch: Partial<typeof found> = {};
      if (hint?.basis && hint.basis !== found.weightBasis) patch.weightBasis = hint.basis;
      if (hint?.unilateral && !found.unilateral) patch.unilateral = true;
      if (Object.keys(patch).length) {
        exStmts.push(db.update(t.exercises).set(patch).where(eq(t.exercises.id, found.id)));
        Object.assign(found, patch);
      }
      return found.id;
    }
    const lib = EXERCISE_LIBRARY.find((e) => key(e.name) === k);
    const row = {
      id: crypto.randomUUID(),
      userId,
      name: name.trim(),
      muscle: lib?.muscle ?? guessMuscle(name),
      equipment: lib?.equipment ?? null,
      type: lib?.type ?? ("weight" as const),
      weightBasis: hint?.basis ?? lib?.weightBasis ?? ("total" as const),
      unilateral: hint?.unilateral ?? lib?.unilateral ?? false,
      cues: lib?.cues ?? null,
      catalogId: catalogIdFor(name),
      createdAt: Date.now(),
    };
    exStmts.push(db.insert(t.exercises).values(row));
    exByName.set(k, row);
    created.push(row.name);
    return row.id;
  };

  // ── routines ──
  const tplByName = new Map(tplRows.map((r) => [key(r.name), r]));
  const routines: ImportReport["routines"] = [];
  let colorIdx = tplRows.length;
  const existingTe = tplRows.length
    ? await db.select().from(t.templateExercises).where(inArray(t.templateExercises.templateId, tplRows.map((r) => r.id)))
    : [];
  const seenRoutine = new Set<string>();
  for (const d of parsed.days) {
    if (!d.exercises.length || seenRoutine.has(key(d.session))) continue;
    seenRoutine.add(key(d.session));
    const existing = tplByName.get(key(d.session));
    const starter = STARTER_ROUTINES.find((r) => key(r.name) === key(d.session));
    const totalSets = d.exercises.reduce((a, e) => a + e.sets, 0);
    let id: string;
    if (existing) {
      id = existing.id;
      stmts.push(
        db
          .update(t.workoutTemplates)
          .set({ notes: d.notes ?? existing.notes })
          .where(eq(t.workoutTemplates.id, id)),
      );
      stmts.push(db.delete(t.templateExercises).where(eq(t.templateExercises.templateId, id)));
    } else {
      id = crypto.randomUUID();
      const row = {
        id,
        userId,
        name: d.session,
        focus: starter?.focus ?? null,
        color: starter?.color ?? PALETTE[colorIdx++ % PALETTE.length],
        estimatedMin: starter?.estimatedMin ?? Math.round((totalSets * 3 + 10) / 5) * 5,
        notes: d.notes,
        createdAt: Date.now(),
        archived: false,
      };
      stmts.push(db.insert(t.workoutTemplates).values(row));
      tplByName.set(key(d.session), row);
    }
    const prevRest = new Map(existingTe.filter((te) => te.templateId === id).map((te) => [te.exerciseId, te.restSec]));
    const rows = d.exercises.map((e, i) => {
      const exerciseId = ensureExercise(e.name);
      return {
        templateId: id,
        exerciseId,
        sortOrder: i,
        sets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        reps: repsLabel(e.repsMin, e.repsMax, "8–12"),
        provisional: e.provisional,
        notes: e.notes,
        restSec: prevRest.get(exerciseId) ?? restFor(e.repsMax),
      };
    });
    if (rows.length) stmts.push(db.insert(t.templateExercises).values(rows));
    routines.push({ name: d.session, exercises: rows.length, action: existing ? "update" : "create" });
  }

  // ── schedule ──
  const schedule: ImportReport["schedule"] = [];
  for (const d of parsed.days) {
    const tpl = d.exercises.length ? tplByName.get(key(d.session)) : undefined;
    const prev = schedRows.find((r) => r.weekday === d.weekday);
    const values = {
      templateId: tpl?.id ?? null,
      label: tpl ? null : d.session,
      notes: tpl ? (prev?.templateId === tpl.id ? prev.notes : null) : d.notes,
      startMin: prev?.startMin ?? null,
      durationMin: tpl?.estimatedMin ?? 30,
    };
    stmts.push(
      db
        .insert(t.gymSchedule)
        .values({ userId, weekday: d.weekday, ...values })
        .onConflictDoUpdate({ target: [t.gymSchedule.userId, t.gymSchedule.weekday], set: values }),
    );
    schedule.push({ weekday: d.weekday, name: d.session, routine: !!tpl });
  }

  if (parsed.trainingNotes != null) {
    stmts.push(db.update(t.users).set({ trainingNotes: parsed.trainingNotes }).where(eq(t.users.id, userId)));
  }

  // ── logs (upsert by user + date + name) ──
  const dates = [...new Set(parsed.logs.map((l) => l.date))];
  const existingLogs = dates.length
    ? await db
        .select({ id: t.workoutLogs.id, date: t.workoutLogs.date, name: t.workoutLogs.name })
        .from(t.workoutLogs)
        .where(and(eq(t.workoutLogs.userId, userId), inArray(t.workoutLogs.date, dates)))
    : [];
  const logs: ImportReport["logs"] = [];
  for (const l of parsed.logs) {
    const match = existingLogs.find((e) => e.date === l.date && key(e.name) === key(l.name));
    const sched = schedRows.find((r) => r.weekday === weekdayOf(l.date));
    const startedAt = zonedMs(l.date, sched?.startMin ?? 18 * 60, tz);
    const values = {
      templateId: tplByName.get(key(l.name))?.id ?? null,
      plannedTemplateId: l.plannedName ? (tplByName.get(key(l.plannedName))?.id ?? null) : null,
      name: l.name,
      date: l.date,
      status: l.status,
      skipReason: l.skipReason,
      notes: l.notes,
      startedAt,
      endedAt: null,
    };
    const id = match?.id ?? crypto.randomUUID();
    if (match) {
      stmts.push(db.update(t.workoutLogs).set(values).where(eq(t.workoutLogs.id, id)));
      stmts.push(db.delete(t.setLogs).where(eq(t.setLogs.workoutLogId, id)));
    } else {
      stmts.push(db.insert(t.workoutLogs).values({ id, userId, ...values }));
    }
    const setRows = l.exercises.flatMap((e, order) => {
      const exerciseId = ensureExercise(e.name);
      return e.sets.map((x, i) => ({
        workoutLogId: id,
        exerciseId,
        exerciseOrder: order,
        setIndex: i,
        warmup: x.warmup,
        reps: x.reps,
        weightKg: x.weightKg,
        note: x.note,
        done: true,
      }));
    });
    if (setRows.length) stmts.push(db.insert(t.setLogs).values(setRows));
    logs.push({
      date: l.date,
      name: l.name,
      status: l.status,
      sets: setRows.filter((r) => !r.warmup).length,
      action: match ? "update" : "create",
    });
  }

  const all = [...exStmts, ...stmts];
  if (!opts.dryRun && all.length) await db.batch(all as unknown as Parameters<typeof db.batch>[0]);

  return {
    routines,
    schedule,
    exercisesCreated: created,
    logs,
    ignoredDays: parsed.ignoredDays,
    warnings: parsed.warnings,
    trainingNotes: parsed.trainingNotes != null,
  };
}
