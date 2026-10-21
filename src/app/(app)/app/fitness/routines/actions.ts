"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { isPaletteColor, PALETTE } from "@/lib/colors";
import { ownExercise, ownTemplate } from "@/lib/fitness";
import { repsLabel } from "@/lib/fitness-library";
import { bool, clamp, int, reqStr, str } from "@/lib/form";

export async function createRoutine() {
  const user = await requireUser();
  const count = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.workoutTemplates)
    .where(eq(t.workoutTemplates.userId, user.id))
    .get();
  const row = await db
    .insert(t.workoutTemplates)
    .values({
      userId: user.id,
      name: "New routine",
      color: PALETTE[Number(count?.n ?? 0) % PALETTE.length],
      estimatedMin: 45,
    })
    .returning({ id: t.workoutTemplates.id })
    .get();
  redirect(`/app/fitness/routines/${row.id}?new=1`);
}

export async function updateRoutine(fd: FormData) {
  const user = await requireUser();
  const r = await ownTemplate(user.id, reqStr(fd, "id"));
  const color = str(fd, "color");
  await db
    .update(t.workoutTemplates)
    .set({
      name: reqStr(fd, "name", 60),
      focus: str(fd, "focus")?.slice(0, 80) ?? null,
      color: isPaletteColor(color) ? color : r.color,
      estimatedMin: clamp(int(fd, "estimatedMin") ?? r.estimatedMin, 5, 300),
      notes: str(fd, "notes")?.slice(0, 1000) ?? null,
    })
    .where(eq(t.workoutTemplates.id, r.id));
  refresh();
}

export async function deleteRoutine(id: string) {
  const user = await requireUser();
  const r = await ownTemplate(user.id, id);
  // keep history: logs keep their name, the template link is set null by the FK
  await db.delete(t.workoutTemplates).where(eq(t.workoutTemplates.id, r.id));
  refresh();
  redirect("/app/fitness/routines");
}

async function ownTemplateExercise(userId: string, id: string) {
  const row = await db
    .select({ te: t.templateExercises })
    .from(t.templateExercises)
    .innerJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.templateExercises.templateId))
    .where(and(eq(t.templateExercises.id, id), eq(t.workoutTemplates.userId, userId)))
    .get();
  if (!row) throw new Error("Exercise not found in routine");
  return row.te;
}

export async function addRoutineExercise(templateId: string, exerciseId: string) {
  const user = await requireUser();
  const [r, ex, last] = await Promise.all([
    ownTemplate(user.id, templateId),
    ownExercise(user.id, exerciseId),
    db
      .select({ max: sql<number>`coalesce(max(${t.templateExercises.sortOrder}), -1)` })
      .from(t.templateExercises)
      .where(eq(t.templateExercises.templateId, templateId))
      .get(),
  ]);
  const cardio = ex.type === "cardio";
  await db.insert(t.templateExercises).values({
    templateId: r.id,
    exerciseId: ex.id,
    sortOrder: Number(last?.max ?? -1) + 1,
    sets: cardio ? 1 : 3,
    repsMin: cardio ? null : 8,
    repsMax: cardio ? null : 12,
    reps: cardio ? "20-40 min" : repsLabel(8, 12),
    restSec: 90,
  });
  refresh();
}

export async function updateRoutineExercise(fd: FormData) {
  const user = await requireUser();
  const te = await ownTemplateExercise(user.id, reqStr(fd, "id"));
  let repsMin = int(fd, "repsMin");
  let repsMax = int(fd, "repsMax");
  if (repsMin != null) repsMin = clamp(repsMin, 1, 500);
  if (repsMax != null) repsMax = clamp(repsMax, 1, 500);
  if (repsMin != null && repsMax != null && repsMax < repsMin) [repsMin, repsMax] = [repsMax, repsMin];
  if (repsMin == null && repsMax != null) repsMin = repsMax;
  await db
    .update(t.templateExercises)
    .set({
      sets: clamp(int(fd, "sets") ?? te.sets, 1, 20),
      repsMin,
      repsMax,
      reps: repsLabel(repsMin, repsMax, str(fd, "reps") ?? te.reps),
      restSec: clamp(int(fd, "restSec") ?? te.restSec, 0, 900),
      notes: str(fd, "notes")?.slice(0, 300) ?? null,
      provisional: bool(fd, "provisional"),
    })
    .where(eq(t.templateExercises.id, te.id));
  refresh();
}

export async function removeRoutineExercise(id: string) {
  const user = await requireUser();
  const te = await ownTemplateExercise(user.id, id);
  await db.delete(t.templateExercises).where(eq(t.templateExercises.id, te.id));
  refresh();
}

export async function moveRoutineExercise(id: string, dir: -1 | 1) {
  const user = await requireUser();
  const te = await ownTemplateExercise(user.id, id);
  const rows = await db
    .select({ id: t.templateExercises.id })
    .from(t.templateExercises)
    .where(eq(t.templateExercises.templateId, te.templateId))
    .orderBy(asc(t.templateExercises.sortOrder), asc(t.templateExercises.id));
  const ids = rows.map((r) => r.id);
  const i = ids.indexOf(te.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const stmts = ids.map((rid, order) =>
    db.update(t.templateExercises).set({ sortOrder: order }).where(eq(t.templateExercises.id, rid)),
  );
  await db.batch(stmts as [(typeof stmts)[number], ...typeof stmts]);
  refresh();
}
