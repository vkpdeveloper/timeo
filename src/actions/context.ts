"use server";

import { requireUser } from "@/lib/auth";
import { getGoalOptions } from "@/lib/queries";

export type GoalOption = { id: string; title: string; color: string; tier: string };

/** Data client components need to render pickers (goals, today). */
export async function getPickerContext(): Promise<{ today: string; goals: GoalOption[] }> {
  const user = await requireUser();
  return { today: user.today, goals: await getGoalOptions(user.id) };
}
