"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { ownWorkout } from "@/lib/fitness";

export async function deleteWorkout(id: string) {
  const user = await requireUser();
  const log = await ownWorkout(user.id, id);
  await db.delete(t.workoutLogs).where(eq(t.workoutLogs.id, log.id));
  refresh();
  redirect("/fitness/history");
}
