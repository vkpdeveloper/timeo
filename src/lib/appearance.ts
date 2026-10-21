import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { isAccent, isColorMode, type Accent, type ColorMode } from "@/lib/themes";

/**
 * The account's saved mode, or null when it has never picked one ("system"
 * from before Timeo 3): then each device keeps the mode it resolved from its OS.
 */
export async function getColorMode(userId: string): Promise<ColorMode | null> {
  const row = await db.select({ mode: t.users.colorMode }).from(t.users).where(eq(t.users.id, userId)).get();
  return isColorMode(row?.mode) ? row.mode : null;
}

/**
 * The account's accent (kept in users.theme, the old theme id column), or null
 * when it has never picked one: then each device shows its own (Sky by default).
 */
export async function getAccent(userId: string): Promise<Accent | null> {
  const row = await db.select({ accent: t.users.theme }).from(t.users).where(eq(t.users.id, userId)).get();
  return isAccent(row?.accent) ? row.accent : null;
}
