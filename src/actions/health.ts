"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { clamp, date, int, num, reqStr, str } from "@/lib/form";

// Shared nutrition, hydration and body actions (used by Fitness, Today and Quick add).

export async function logMeal(fd: FormData) {
  const user = await requireUser();
  await db.insert(t.mealLogs).values({
    userId: user.id,
    date: date(fd, "date") ?? user.today,
    name: reqStr(fd, "name", 120),
    calories: clamp(int(fd, "calories") ?? 0, 0, 10000),
    proteinG: clamp(int(fd, "protein") ?? 0, 0, 1000),
    carbsG: clamp(int(fd, "carbs") ?? 0, 0, 2000),
    fatG: clamp(int(fd, "fat") ?? 0, 0, 1000),
    planMealId: str(fd, "planMealId"),
  });
  refresh();
}

/** One tap: log a meal from the active diet plan exactly as planned. */
export async function logPlannedMeal(planMealId: string, day?: string) {
  const user = await requireUser();
  const meal = await db
    .select({ m: t.dietPlanMeals })
    .from(t.dietPlanMeals)
    .innerJoin(t.dietPlans, eq(t.dietPlans.id, t.dietPlanMeals.planId))
    .where(and(eq(t.dietPlanMeals.id, planMealId), eq(t.dietPlans.userId, user.id)))
    .get();
  if (!meal) throw new Error("Meal not found");
  await db.insert(t.mealLogs).values({
    userId: user.id,
    date: day ?? user.today,
    planMealId,
    name: meal.m.name,
    calories: meal.m.calories,
    proteinG: meal.m.proteinG,
    carbsG: meal.m.carbsG,
    fatG: meal.m.fatG,
  });
  refresh();
}

export async function deleteMealLog(id: string) {
  const user = await requireUser();
  await db.delete(t.mealLogs).where(and(eq(t.mealLogs.id, id), eq(t.mealLogs.userId, user.id)));
  refresh();
}

/** Adds (or with a negative value removes) water for a day. */
export async function addWater(ml: number, day?: string) {
  const user = await requireUser();
  const d = day ?? user.today;
  const delta = clamp(Math.round(ml), -5000, 5000);
  await db
    .insert(t.dailyLogs)
    .values({ userId: user.id, date: d, waterMl: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: [t.dailyLogs.userId, t.dailyLogs.date],
      set: { waterMl: sql`max(0, ${t.dailyLogs.waterMl} + ${delta})` },
    });
  refresh();
}

export async function setDailyMetrics(fd: FormData) {
  const user = await requireUser();
  const d = date(fd, "date") ?? user.today;
  const steps = int(fd, "steps");
  const sleepHours = num(fd, "sleepHours");
  await db
    .insert(t.dailyLogs)
    .values({ userId: user.id, date: d, steps, sleepHours })
    .onConflictDoUpdate({
      target: [t.dailyLogs.userId, t.dailyLogs.date],
      set: { steps, sleepHours },
    });
  refresh();
}

export async function logBodyMetric(fd: FormData) {
  const user = await requireUser();
  const d = date(fd, "date") ?? user.today;
  const weightKg = num(fd, "weightKg");
  const bodyFatPct = num(fd, "bodyFatPct");
  const waistCm = num(fd, "waistCm");
  const notes = str(fd, "notes");
  if (weightKg == null && bodyFatPct == null && waistCm == null) throw new Error("Enter at least one measurement");
  await db
    .insert(t.bodyMetrics)
    .values({ userId: user.id, date: d, weightKg, bodyFatPct, waistCm, notes })
    .onConflictDoUpdate({
      target: [t.bodyMetrics.userId, t.bodyMetrics.date],
      set: { weightKg, bodyFatPct, waistCm, notes },
    });
  refresh();
}

export async function deleteBodyMetric(id: string) {
  const user = await requireUser();
  await db.delete(t.bodyMetrics).where(and(eq(t.bodyMetrics.id, id), eq(t.bodyMetrics.userId, user.id)));
  refresh();
}
