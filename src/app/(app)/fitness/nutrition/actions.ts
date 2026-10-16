"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { DIET_GOALS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { parseTime } from "@/lib/dates";
import { DIET_LIBRARY } from "@/lib/diet-library";
import { ownPlan } from "@/lib/fitness";
import { clamp, int, oneOf, reqStr, str, time } from "@/lib/form";

async function hasActive(userId: string) {
  const row = await db
    .select({ id: t.dietPlans.id })
    .from(t.dietPlans)
    .where(and(eq(t.dietPlans.userId, userId), eq(t.dietPlans.active, true)))
    .get();
  return !!row;
}

/** Copies a library plan (and its meals). Becomes active when none is. */
export async function addLibraryPlan(slug: string) {
  const user = await requireUser();
  const lib = DIET_LIBRARY.find((p) => p.slug === slug);
  if (!lib) throw new Error("Plan not found");
  const active = !(await hasActive(user.id));
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(t.dietPlans).values({
      id,
      userId: user.id,
      name: lib.name,
      goal: lib.goal,
      calories: lib.calories,
      proteinG: lib.proteinG,
      carbsG: lib.carbsG,
      fatG: lib.fatG,
      waterMl: lib.waterMl,
      description: lib.description,
      source: lib.slug,
      active,
    }),
    db.insert(t.dietPlanMeals).values(
      lib.meals.map((m, i) => ({
        planId: id,
        name: m.name,
        timeMin: parseTime(m.time),
        items: m.items.join("\n"),
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        sortOrder: i,
      })),
    ),
  ]);
  refresh();
}

export async function createPlan() {
  const user = await requireUser();
  const active = !(await hasActive(user.id));
  const row = await db
    .insert(t.dietPlans)
    .values({ userId: user.id, name: "My plan", calories: 2200, proteinG: 140, carbsG: 250, fatG: 70, active })
    .returning({ id: t.dietPlans.id })
    .get();
  redirect(`/fitness/nutrition/plans/${row.id}?new=1`);
}

export async function updatePlan(fd: FormData) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, reqStr(fd, "id"));
  await db
    .update(t.dietPlans)
    .set({
      name: reqStr(fd, "name", 60),
      goal: oneOf(fd, "goal", DIET_GOALS, plan.goal),
      calories: clamp(int(fd, "calories") ?? plan.calories, 0, 10000),
      proteinG: clamp(int(fd, "proteinG") ?? plan.proteinG, 0, 1000),
      carbsG: clamp(int(fd, "carbsG") ?? plan.carbsG, 0, 2000),
      fatG: clamp(int(fd, "fatG") ?? plan.fatG, 0, 1000),
      waterMl: clamp(int(fd, "waterMl") ?? plan.waterMl, 0, 10000),
      description: str(fd, "description")?.slice(0, 500) ?? null,
    })
    .where(eq(t.dietPlans.id, plan.id));
  refresh();
}

export async function deletePlan(id: string) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, id);
  await db.delete(t.dietPlans).where(eq(t.dietPlans.id, plan.id));
  refresh();
  redirect("/fitness/nutrition");
}

/** Only one plan is active at a time. */
export async function setActivePlan(id: string) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, id);
  await db.batch([
    db.update(t.dietPlans).set({ active: false }).where(eq(t.dietPlans.userId, user.id)),
    db.update(t.dietPlans).set({ active: true }).where(eq(t.dietPlans.id, plan.id)),
  ]);
  refresh();
}

export async function deactivatePlan(id: string) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, id);
  await db.update(t.dietPlans).set({ active: false }).where(eq(t.dietPlans.id, plan.id));
  refresh();
}

export async function savePlanMeal(fd: FormData) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, reqStr(fd, "planId"));
  const values = {
    name: reqStr(fd, "name", 60),
    timeMin: time(fd, "time"),
    items: str(fd, "items")?.slice(0, 1000) ?? null,
    calories: clamp(int(fd, "calories") ?? 0, 0, 10000),
    proteinG: clamp(int(fd, "proteinG") ?? 0, 0, 1000),
    carbsG: clamp(int(fd, "carbsG") ?? 0, 0, 2000),
    fatG: clamp(int(fd, "fatG") ?? 0, 0, 1000),
  };
  const id = str(fd, "id");
  if (id) {
    await db
      .update(t.dietPlanMeals)
      .set(values)
      .where(and(eq(t.dietPlanMeals.id, id), eq(t.dietPlanMeals.planId, plan.id)));
  } else {
    const max = await db
      .select({ m: sql<number>`coalesce(max(${t.dietPlanMeals.sortOrder}), -1)` })
      .from(t.dietPlanMeals)
      .where(eq(t.dietPlanMeals.planId, plan.id))
      .get();
    await db.insert(t.dietPlanMeals).values({ planId: plan.id, sortOrder: Number(max?.m ?? -1) + 1, ...values });
  }
  refresh();
}

export async function deletePlanMeal(planId: string, mealId: string) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, planId);
  await db.delete(t.dietPlanMeals).where(and(eq(t.dietPlanMeals.id, mealId), eq(t.dietPlanMeals.planId, plan.id)));
  refresh();
}

/** Sets plan targets to the sum of its meals. */
export async function syncPlanTotals(planId: string) {
  const user = await requireUser();
  const plan = await ownPlan(user.id, planId);
  const s = await db
    .select({
      c: sql<number>`coalesce(sum(${t.dietPlanMeals.calories}), 0)`,
      p: sql<number>`coalesce(sum(${t.dietPlanMeals.proteinG}), 0)`,
      cb: sql<number>`coalesce(sum(${t.dietPlanMeals.carbsG}), 0)`,
      f: sql<number>`coalesce(sum(${t.dietPlanMeals.fatG}), 0)`,
    })
    .from(t.dietPlanMeals)
    .where(eq(t.dietPlanMeals.planId, plan.id))
    .get();
  await db
    .update(t.dietPlans)
    .set({ calories: Number(s?.c ?? 0), proteinG: Number(s?.p ?? 0), carbsG: Number(s?.cb ?? 0), fatG: Number(s?.f ?? 0) })
    .where(eq(t.dietPlans.id, plan.id));
  refresh();
}
