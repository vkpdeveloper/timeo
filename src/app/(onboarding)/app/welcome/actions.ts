"use server";

import { refresh } from "next/cache";
import { createSeason } from "@/app/(app)/app/goals/actions";
import { updateDayHours, updateTimezone } from "@/app/(app)/app/settings/actions";
import { GOAL_AREAS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";

export type OnboardingDraft = {
  timezone: string;
  /** "HH:MM" */
  dayStart: string;
  dayEnd: string;
  seasonName: string;
  startDate: string;
  capacityHours: number;
  goals: { title: string; area: string; color: string; weeklyHours: number }[];
};

/**
 * Saves the first run in one go: timezone and planner day (through the
 * settings actions), then the season and its goals (through createSeason).
 * Never touches an account that already has an active season.
 */
export async function finishOnboarding(draft: OnboardingDraft): Promise<{ error?: string } | void> {
  const user = await requireUser();

  if (draft.timezone && draft.timezone !== user.timezone) {
    const fd = new FormData();
    fd.set("timezone", String(draft.timezone));
    const res = await updateTimezone(fd);
    if (res?.error) return res;
  }

  const hours = new FormData();
  hours.set("start", String(draft.dayStart ?? ""));
  hours.set("end", String(draft.dayEnd ?? ""));
  const res = await updateDayHours(hours);
  if (res?.error) return res;

  if (!(await getActiveSeason(user.id))) {
    const goals = (Array.isArray(draft.goals) ? draft.goals : []).slice(0, 3);
    await createSeason(
      {
        name: String(draft.seasonName ?? ""),
        intention: "",
        startDate: String(draft.startDate ?? ""),
        capacityHours: Number(draft.capacityHours) || 15,
        brainDump: "",
        goals: goals.map((g, i) => ({
          title: String(g?.title ?? ""),
          outcome: "",
          tier: i < 2 ? "core" : "secondary",
          area: GOAL_AREAS.find((a) => a === g?.area) ?? "work",
          color: String(g?.color ?? ""),
          weeklyHours: Number(g?.weeklyHours) || 0,
          system: "",
          milestones: [],
        })),
      },
      { stay: true },
    );
  }
  refresh();
}
