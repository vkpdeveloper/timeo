import { cn } from "@/lib/cn";
import { addDays, diffDays, formatDuration, formatMonthDay } from "@/lib/dates";
import type { GoalStatus } from "./data";

const DOT: Record<GoalStatus, string> = { on_track: "bg-ok", adjust: "bg-warn", off_track: "bg-bad" }; // bad is a stronger amber

/** Season week number for the calendar week starting on `weekStart`, or null outside the season. */
export function seasonWeek(weekStart: string, season?: { startDate: string; endDate: string } | null) {
  if (!season || addDays(weekStart, 6) < season.startDate || weekStart > season.endDate) return null;
  const from = weekStart < season.startDate ? season.startDate : weekStart;
  return Math.floor(diffDays(from, season.startDate) / 7) + 1;
}

/** "Week 6 · Oct 5 – 11" inside the season, otherwise just the dates. */
export function weekLabel(weekStart: string, season?: { startDate: string; endDate: string } | null) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  const range = `${formatMonthDay(weekStart)} – ${sameMonth ? Number(end.slice(8)) : formatMonthDay(end)}`;
  const week = seasonWeek(weekStart, season);
  return week ? `Week ${week} · ${range}` : range;
}

export function StatusDots({
  updates,
  className,
}: {
  updates: { status: GoalStatus; title: string }[];
  className?: string;
}) {
  if (!updates.length) return null;
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {updates.map((u, i) => (
        <span key={i} title={u.title} className={cn("size-2 rounded-full", DOT[u.status])} />
      ))}
    </span>
  );
}

/** Minutes to the nearest quarter hour for summaries ("14h 30m"); zero reads "0h". */
export function roundedTime(min: number) {
  if (min <= 0) return "0h";
  return formatDuration(Math.round(min / 15) * 15 || Math.round(min));
}
