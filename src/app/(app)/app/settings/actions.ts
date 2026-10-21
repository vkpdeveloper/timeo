"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { destroySession, requireUser } from "@/lib/auth";
import { str, time } from "@/lib/form";
import { deleteUserData } from "@/lib/user-data";

export type Result = { error?: string } | void;

export async function updateName(fd: FormData): Promise<Result> {
  const user = await requireUser();
  const name = str(fd, "name")?.slice(0, 80);
  if (!name) return { error: "Add a name" };
  await db.update(t.users).set({ name }).where(eq(t.users.id, user.id));
  refresh();
}

export async function updateTimezone(fd: FormData): Promise<Result> {
  const user = await requireUser();
  const tz = str(fd, "timezone")?.slice(0, 80);
  try {
    if (!tz) throw new Error();
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return { error: "Pick a timezone from the list" };
  }
  await db.update(t.users).set({ timezone: tz }).where(eq(t.users.id, user.id));
  refresh();
}

export async function updateDayHours(fd: FormData): Promise<Result> {
  const user = await requireUser();
  const start = time(fd, "start");
  const end = time(fd, "end");
  if (start == null || end == null) return { error: "Pick a start and end time" };
  if (end - start < 60) return { error: "End at least an hour after the start" };
  await db.update(t.users).set({ dayStartMin: start, dayEndMin: end }).where(eq(t.users.id, user.id));
  refresh();
}

/** Permanently deletes the account and every row it owns. */
export async function deleteAccount(fd: FormData): Promise<Result> {
  const user = await requireUser();
  if (str(fd, "confirm") !== "DELETE") return { error: "Type DELETE to confirm" };
  await destroySession();
  await deleteUserData(user.id);
  redirect("/signup");
}
