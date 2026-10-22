import type { Block } from "@/db/schema";

export type GoalInfo = { id: string; title: string; color: string };

/** A block plus what the planner needs to draw it. */
export type PlanBlock = Block & { color: string | null; goalTitle: string | null };

/** The gym split's suggestion for a day with no workout block yet. */
export type Ghost = {
  date: string;
  name: string;
  color: string;
  startMin: number | null;
  durationMin: number;
};

export type UnscheduledTask = {
  id: string;
  title: string;
  goalId: string | null;
  dueDate: string | null;
  estimateMin: number | null;
  /** the connected app it came from */
  source: string | null;
  overdue: boolean;
  slot: { start: number; end: number } | null;
};

export type PlanView = "day" | "week";
