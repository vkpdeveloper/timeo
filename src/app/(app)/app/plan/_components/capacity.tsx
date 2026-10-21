import type { ReactNode } from "react";
import { AskTimi, TimeMeter } from "@/components/ui/primitives";
import { GUIDE } from "@/lib/ai/guide";
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

export function capacityText(c: Capacity, suffix?: string) {
  if (c.past) return c.count ? `${formatDuration(c.plannedTotal)} planned · ${c.done} of ${c.count} done` : "Nothing was planned";
  const planned = c.plannedTotal ? `${formatDuration(c.plannedTotal)} planned` : "Nothing planned";
  return `${planned} · ${formatDuration(c.freeMin)} free${suffix ? ` ${suffix}` : ""}`;
}

/**
 * The capacity line pinned under the week strip: "Wed · 5h 20m planned · 2h free",
 * a small done / planned / free meter, and an optional action.
 */
export function CapacityBar({
  label,
  capacity: c,
  suffix,
  action,
}: {
  label: ReactNode;
  capacity: Capacity;
  suffix?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`flex h-11 items-center gap-3 border-t border-line pl-2.5 lg:pl-3 ${action ? "pr-1" : "pr-3"}`}>
      <p className="tnum min-w-0 flex-1 truncate text-[13px] text-ink-3">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-line-strong"> · </span>
        {capacityText(c, suffix)}
      </p>
      {(c.plannedTotal > 0 || c.freeMin > 0) && (
        <TimeMeter
          className="hidden w-24 shrink-0 sm:block"
          legend={false}
          doneMin={c.doneMin}
          plannedMin={c.plannedMin}
          freeMin={c.freeMin}
        />
      )}
      {action}
    </div>
  );
}

/** A light week: say how far short the goal time is and offer Timi's week plan. */
export function LightWeekHint({
  goalPlanned,
  goalTarget,
  className,
}: {
  goalPlanned: number;
  goalTarget: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong py-2 pr-2 pl-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-3">
          {goalTarget > 0 ? (
            <>
              <span className="font-medium text-ink-2">A light week.</span>{" "}
              {goalPlanned > 0
                ? `${formatDuration(goalPlanned)} of ${formatDuration(goalTarget)} goal time planned.`
                : `No goal time planned yet. Goals need ${formatDuration(goalTarget)}.`}
            </>
          ) : (
            <>
              <span className="font-medium text-ink-2">A light week.</span> Block time for what matters.
            </>
          )}
        </p>
        <AskTimi prompt={GUIDE.planWeek} label="Plan my week" />
      </div>
    </div>
  );
}
