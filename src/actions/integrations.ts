"use server";

import { requireUser } from "@/lib/auth";
import { syncUser } from "@/lib/integrations/sync";

/** Syncs connected apps not synced in the last five minutes. True when something here changed. */
export async function syncOnOpen(): Promise<boolean> {
  const user = await requireUser();
  return syncUser(user.id, user.timezone, { minAgeMs: 5 * 60_000 });
}
