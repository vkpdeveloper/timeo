"use client";

import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/components/ui/motion";
import { colorVar } from "@/lib/colors";
import { formatDuration, formatWeekdayShort, WEEKDAY_LETTER } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { EnergyRow } from "./data";

/** Focus minutes per day, Monday to Sunday, today highlighted. Fixed height at any width; bars grow in on mount. */
export function FocusWeekChart({ days, today }: { days: { date: string; focusMin: number }[]; today: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(60, ...days.map((d) => d.focusMin));
  // round the scale up to a whole hour so the guide line reads cleanly
  const scaleMax = Math.ceil(max / 60) * 60;
  const best = days.reduce((b, d) => (d.focusMin > b.focusMin ? d : b), days[0]);

  return (
    <div role="img" aria-label="Focus minutes per day this week">
      <div className="relative h-[104px] border-b border-line">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="tnum absolute top-0.5 left-0 text-[10px] font-medium text-ink-3">{formatDuration(scaleMax)}</span>
        <div className="absolute inset-x-0 top-4 bottom-0 grid grid-cols-7">
          {days.map((d, i) => {
            const isToday = d.date === today;
            const future = d.date > today;
            const pct = d.focusMin > 0 ? Math.max(8, (d.focusMin / scaleMax) * 100) : 0;
            const showValue = d.focusMin > 0 && (isToday || d.date === best.date);
            return (
              <div
                key={d.date}
                className="flex h-full flex-col items-center justify-end"
                title={`${formatWeekdayShort(d.date)}: ${d.focusMin ? formatDuration(d.focusMin) : "no focus"}`}
              >
                {showValue && (
                  <motion.span
                    className={cn("tnum mb-1 text-[10px] font-semibold whitespace-nowrap", isToday ? "text-ink" : "text-ink-3")}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.04, duration: 0.2 }}
                  >
                    {formatDuration(d.focusMin)}
                  </motion.span>
                )}
                {pct > 0 ? (
                  <motion.span
                    className="block w-6 max-w-[60%] rounded-t-[6px] rounded-b-[2px]"
                    style={{
                      height: `${pct}%`,
                      originY: 1,
                      background: isToday ? "var(--accent)" : "color-mix(in oklab, var(--ink) 22%, var(--surface))",
                    }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ ...springs.gentle, delay: 0.08 + i * 0.04 }}
                  />
                ) : (
                  <span className={cn("mb-0.5 block size-1 rounded-full", future ? "bg-sunken" : "bg-line-strong")} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-7">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={cn("text-center text-[11px]", d.date === today ? "font-bold text-ink" : "font-medium text-ink-3")}
          >
            {WEEKDAY_LETTER[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

const GAVE = "var(--c-teal)";
const DRAINED = "var(--c-rose)";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

/** Diverging bars: average energy after sessions, -2 (drained) to +2 (energised). */
export function EnergyBars({ rows }: { rows: EnergyRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const pct = (Math.min(2, Math.abs(row.avg)) / 2) * 50;
        const positive = row.avg >= 0;
        return (
          <li key={row.key} title={`${row.sessions} sessions · ${formatDuration(row.minutes)}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink">
                {row.color && <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(row.color) }} />}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="tnum shrink-0 text-[12.5px] text-ink-3">
                {formatDuration(row.minutes)} ·{" "}
                <span className="font-semibold text-ink-2">{signed(row.avg)}</span>
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-sunken">
              <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-line-strong" />
              {pct > 0 && (
                <span
                  className={cn("meter-grow absolute inset-y-0", positive ? "left-1/2 rounded-r-full" : "right-1/2 rounded-l-full")}
                  style={{ width: `${pct}%`, background: positive ? GAVE : DRAINED, transformOrigin: positive ? "left center" : "right center" }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EnergyLegend() {
  return (
    <div className="flex justify-between text-[11.5px] font-medium text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: DRAINED }} />
        Drained
      </span>
      <span className="inline-flex items-center gap-1.5">
        Gave energy
        <span className="size-2 rounded-full" style={{ background: GAVE }} />
      </span>
    </div>
  );
}
