import { Dumbbell, Inbox, Sun, Target, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import type { Block } from "@/db/schema";
import { colorVar, softVar } from "@/lib/colors";

export const KIND_LABEL: Record<Block["kind"], string> = {
  focus: "Focus",
  meeting: "Meeting",
  workout: "Workout",
  meal: "Meal",
  life: "Life",
  admin: "Admin",
};

export const KIND_ICON: Record<Block["kind"], LucideIcon> = {
  focus: Target,
  meeting: Users,
  workout: Dumbbell,
  meal: UtensilsCrossed,
  life: Sun,
  admin: Inbox,
};


/** Bar and fill colours for a block: its goal (or routine) colour, otherwise neutral. */
export function blockColors(color: string | null) {
  if (color) return { bar: colorVar(color), fill: softVar(color), ink: colorVar(color) };
  return { bar: "var(--ink-3)", fill: "var(--surface)", ink: "var(--ink-2)" };
}

export function blockVars(color: string | null): CSSProperties {
  const c = blockColors(color);
  return { ["--bar" as string]: c.bar, ["--fill" as string]: c.fill, ["--bar-ink" as string]: c.ink };
}
