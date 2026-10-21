"use client";

import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/components/ui/motion";

/**
 * The season as twelve week segments: past weeks in a soft accent, this week
 * filling up day by day, the rest empty. Segments grow in left to right.
 */
export function WeekStrip({
  weeks,
  current,
  dayOfWeek,
  startLabel,
  endLabel,
}: {
  weeks: number;
  /** 1-based week; 0 before the season, weeks + 1 after it. */
  current: number;
  /** 0 (Mon) to 6 (Sun), fills the current segment. */
  dayOfWeek: number;
  startLabel: string;
  endLabel: string;
}) {
  const reduce = useReducedMotion();
  const label =
    current < 1 ? "Season not started" : current > weeks ? "Season over" : `Week ${current} of ${weeks}`;
  return (
    <div>
      <div className="flex gap-[3px]" role="img" aria-label={label}>
        {Array.from({ length: weeks }, (_, i) => {
          const w = i + 1;
          const past = w < current;
          const now = w === current;
          return (
            <motion.span
              key={w}
              className="relative h-2 flex-1 origin-left overflow-hidden rounded-full"
              style={{
                background: past
                  ? "color-mix(in oklab, var(--accent) 42%, var(--surface))"
                  : now
                    ? "color-mix(in oklab, var(--accent) 22%, var(--surface))"
                    : "var(--sunken)",
              }}
              initial={reduce ? false : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.025 }}
            >
              {now && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${((dayOfWeek + 1) / 7) * 100}%` }}
                />
              )}
            </motion.span>
          );
        })}
      </div>
      <div className="tnum mt-2 flex justify-between text-[12px] text-ink-3">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
