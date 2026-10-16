import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import {
  CUSTOM_PREFIX,
  DEFAULT_THEME,
  cleanCustomColors,
  customCache,
  isColorMode,
  isThemeValue,
  type ColorMode,
  type CustomCache,
} from "@/lib/themes";

/** The account's active theme and mode, with a custom theme resolved to its variables. */
export async function getAppearance(userId: string): Promise<{ theme: string; mode: ColorMode; custom: CustomCache | null }> {
  const row = await db
    .select({ theme: t.users.theme, mode: t.users.colorMode })
    .from(t.users)
    .where(eq(t.users.id, userId))
    .get();
  const mode = isColorMode(row?.mode) ? row.mode : "system";
  const theme = row && isThemeValue(row.theme) ? row.theme : DEFAULT_THEME;
  if (!theme.startsWith(CUSTOM_PREFIX)) return { theme, mode, custom: null };

  const id = theme.slice(CUSTOM_PREFIX.length);
  const own = await db
    .select({ id: t.userThemes.id, userId: t.userThemes.userId, light: t.userThemes.light, dark: t.userThemes.dark })
    .from(t.userThemes)
    .where(eq(t.userThemes.id, id))
    .get();
  const light = own?.userId === userId ? cleanCustomColors(own.light) : null;
  const dark = own?.userId === userId ? cleanCustomColors(own.dark) : null;
  if (!light || !dark) return { theme: DEFAULT_THEME, mode, custom: null };
  return { theme, mode, custom: customCache(id, light, dark) };
}

export async function listUserThemes(userId: string) {
  const rows = await db
    .select({ id: t.userThemes.id, name: t.userThemes.name, light: t.userThemes.light, dark: t.userThemes.dark })
    .from(t.userThemes)
    .where(eq(t.userThemes.userId, userId))
    .orderBy(t.userThemes.createdAt);
  return rows.flatMap((r) => {
    const light = cleanCustomColors(r.light);
    const dark = cleanCustomColors(r.dark);
    return light && dark ? [{ id: r.id, name: r.name, light, dark }] : [];
  });
}
