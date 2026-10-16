"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { destroySession, requireUser } from "@/lib/auth";
import { reqStr, str, time } from "@/lib/form";
import { deleteUserData } from "@/lib/user-data";

export async function updateName(fd: FormData) {
  const user = await requireUser();
  await db.update(t.users).set({ name: reqStr(fd, "name", 80) }).where(eq(t.users.id, user.id));
  refresh();
}

export async function updateTimezone(fd: FormData) {
  const user = await requireUser();
  const tz = reqStr(fd, "timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error("Unknown timezone");
  }
  await db.update(t.users).set({ timezone: tz }).where(eq(t.users.id, user.id));
  refresh();
}

export async function updateDayHours(fd: FormData) {
  const user = await requireUser();
  const start = time(fd, "start");
  const end = time(fd, "end");
  if (start == null || end == null) throw new Error("Pick a start and end time");
  if (end - start < 60) throw new Error("The day should end at least an hour after it starts");
  await db.update(t.users).set({ dayStartMin: start, dayEndMin: end }).where(eq(t.users.id, user.id));
  refresh();
}

/** Permanently deletes the account and every row it owns. */
export async function deleteAccount(fd: FormData) {
  const user = await requireUser();
  if (str(fd, "confirm") !== "DELETE") throw new Error("Type DELETE to confirm");
  await destroySession();
  await deleteUserData(user.id);
  redirect("/signup");
}
