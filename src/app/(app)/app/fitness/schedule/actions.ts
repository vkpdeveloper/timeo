"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { ownTemplate } from "@/lib/fitness";
import { clamp, int, oneOf, str, time } from "@/lib/form";

export async function saveScheduleDay(fd: FormData) {
  const user = await requireUser();
  const wd = clamp(int(fd, "weekday") ?? -1, -1, 6);
  if (wd < 0) throw new Error("Pick a day");
  const kind = oneOf(fd, "kind", ["routine", "rest"] as const, "rest");
  const chosen = str(fd, "templateId");
  const template = kind === "routine" && chosen ? await ownTemplate(user.id, chosen) : null;
  if (kind === "routine" && !template) throw new Error("Pick a routine");
  const values = {
    templateId: template?.id ?? null,
    label: template ? null : (str(fd, "label")?.slice(0, 80) ?? "Rest"),
    notes: str(fd, "notes")?.slice(0, 300) ?? null,
    startMin: time(fd, "start"),
    durationMin: template?.estimatedMin ?? 30,
  };
  await db
    .insert(t.gymSchedule)
    .values({ userId: user.id, weekday: wd, ...values })
    .onConflictDoUpdate({ target: [t.gymSchedule.userId, t.gymSchedule.weekday], set: values });
  refresh();
}

export async function saveTrainingNotes(fd: FormData) {
  const user = await requireUser();
  await db
    .update(t.users)
    .set({ trainingNotes: str(fd, "trainingNotes")?.slice(0, 3000) ?? null })
    .where(eq(t.users.id, user.id));
  refresh();
}
