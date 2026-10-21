import { AskTimi } from "@/components/ui/primitives";
import { GUIDE } from "@/lib/ai/guide";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/dates";

/** Minutes for one day or a week: everything planned, done, still planned, and free (from now on). */
export type Capacity = {
  plannedTotal: number;
  doneMin: number;
  plannedMin: number;
  freeMin: number;
  /** Entirely in the past: nothing left to plan. */
  past: boolean;
  done: number;
  count: number;
};

/** A day's load for the week ribbon: planned minutes by colour, against the length of the day. */
export type DayLoad = {
  span: number;
  parts: { color: string | null; min: number }[];
};

/** "5h 20m planned, 1h 10m free", or "6h planned, 5 of 5 done" for a day that is over. */
export function capacityText(c: Capacity) {
  if (c.past) return c.count ? `${formatDuration(c.plannedTotal)} planned, ${c.done} of ${c.count} done` : "Nothing was planned";
  const planned = c.plannedTotal ? `${formatDuration(c.plannedTotal)} planned` : "Nothing planned";
  return `${planned}, ${formatDuration(c.freeMin)} free`;
}

/** A light week: one quiet line on how far short the goal time is, and Timi's week plan. */
export function LightWeekHint({
  goalPlanned,
  goalTarget,
  className,
}: {
  goalPlanned: number;
  goalTarget: number;
  className?: string;
}) {
  const text =
    goalTarget > 0
      ? goalPlanned > 0
        ? `${formatDuration(goalPlanned)} of ${formatDuration(goalTarget)} goal time planned`
        : `No goal time planned. Goals need ${formatDuration(goalTarget)}`
      : "Block time for your goals";
  return (
    <div className={cn("rise flex items-center gap-3 px-1", className)}>
      <p className="tnum min-w-0 flex-1 text-[13px] leading-snug text-ink-3">
        <span className="font-medium text-ink-2">A light week.</span> {text}.
      </p>
      <AskTimi prompt={GUIDE.planWeek} label="Plan my week" />
    </div>
  );
}
