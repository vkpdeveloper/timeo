"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { getAppearance } from "@/lib/appearance";
import { requireUser } from "@/lib/auth";
import { CUSTOM_PREFIX, cleanCustomColors, isColorMode, isThemeValue, type ColorMode } from "@/lib/themes";

export type ThemeResult = { error?: string; id?: string } | void;

async function ownThemeId(userId: string, id: string) {
  const row = await db
    .select({ id: t.userThemes.id })
    .from(t.userThemes)
    .where(and(eq(t.userThemes.id, id), eq(t.userThemes.userId, userId)))
    .get();
  return row?.id ?? null;
}

/** The account's saved appearance, read fresh (never from a cached page). */
export async function fetchAppearance() {
  const user = await requireUser();
  return getAppearance(user.id);
}

export async function saveAppearance(theme: string, mode: ColorMode): Promise<ThemeResult> {
  const user = await requireUser();
  if (!isThemeValue(theme) || !isColorMode(mode)) return { error: "Pick a theme and mode" };
  if (theme.startsWith(CUSTOM_PREFIX) && !(await ownThemeId(user.id, theme.slice(CUSTOM_PREFIX.length)))) {
    return { error: "That theme no longer exists" };
  }
  await db.update(t.users).set({ theme, colorMode: mode }).where(eq(t.users.id, user.id));
  refresh();
}

function cleanName(name: unknown) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
}

/** Creates a custom theme and makes it the active one. */
export async function createTheme(name: string, light: unknown, dark: unknown): Promise<ThemeResult> {
  const user = await requireUser();
  const n = cleanName(name);
  const l = cleanCustomColors(light);
  const d = cleanCustomColors(dark);
  if (!n) return { error: "Give it a name" };
  if (!l || !d) return { error: "Use hex colours, like #1f6feb" };
  const count = await db.$count(t.userThemes, eq(t.userThemes.userId, user.id));
  if (count >= 24) return { error: "You can keep up to 24 themes" };
  const row = await db
    .insert(t.userThemes)
    .values({ userId: user.id, name: n, light: l, dark: d })
    .returning({ id: t.userThemes.id })
    .get();
  await db.update(t.users).set({ theme: CUSTOM_PREFIX + row.id }).where(eq(t.users.id, user.id));
  refresh();
  return { id: row.id };
}

export async function updateTheme(id: string, name: string, light: unknown, dark: unknown): Promise<ThemeResult> {
  const user = await requireUser();
  if (!(await ownThemeId(user.id, id))) return { error: "That theme no longer exists" };
  const n = cleanName(name);
  const l = cleanCustomColors(light);
  const d = cleanCustomColors(dark);
  if (!n) return { error: "Give it a name" };
  if (!l || !d) return { error: "Use hex colours, like #1f6feb" };
  await db
    .update(t.userThemes)
    .set({ name: n, light: l, dark: d })
    .where(and(eq(t.userThemes.id, id), eq(t.userThemes.userId, user.id)));
  refresh();
  return { id };
}

/** Deletes a custom theme; if it was active, falls back to Paper. */
export async function deleteTheme(id: string): Promise<ThemeResult> {
  const user = await requireUser();
  if (!(await ownThemeId(user.id, id))) return { error: "That theme no longer exists" };
  await db.delete(t.userThemes).where(and(eq(t.userThemes.id, id), eq(t.userThemes.userId, user.id)));
  await db
    .update(t.users)
    .set({ theme: "paper" })
    .where(and(eq(t.users.id, user.id), eq(t.users.theme, CUSTOM_PREFIX + id)));
  refresh();
}
