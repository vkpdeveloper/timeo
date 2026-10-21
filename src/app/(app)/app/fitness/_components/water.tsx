"use client";

import { Droplet, Minus } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { addWater } from "@/actions/health";
import { RowIcon } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { Bar } from "./charts";

const fmtL = (ml: number) => String(Math.round(ml / 100) / 10);

/**
 * Water for the day with one-tap +250 / +500. Renders as a row, so it sits in
 * a Section card next to other rows; `card` wraps it in its own card.
 */
export function WaterCard({ ml, targetMl, day, card = false }: { ml: number; targetMl: number; day: string; card?: boolean }) {
  const [value, add] = useOptimistic(ml, (v, d: number) => Math.max(0, v + d));
  const [, start] = useTransition();
  const bump = (d: number) =>
    start(async () => {
      add(d);
      await addWater(d, day);
    });
  const left = Math.max(0, targetMl - value);
  return (
    <div className={cn("px-4 py-3", card && "card")}>
      <div className="flex items-center gap-3">
        <RowIcon>
          <Droplet />
        </RowIcon>
        <div className="min-w-0 flex-1">
          <div className="tnum text-[15px] font-medium text-ink">
            {fmtL(value)} <span className="text-ink-3">of {fmtL(targetMl)} L</span>
          </div>
          <div className="tnum truncate text-[13px] text-ink-3">{left > 0 ? `${fmtL(left)} L to go` : "Done for today"}</div>
        </div>
        {value > 0 && (
          <button
            type="button"
            onClick={() => bump(-250)}
            aria-label="Remove 250 ml"
            className="tap -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-3"
          >
            <Minus className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => bump(250)}
          className="tap tnum h-11 shrink-0 rounded-[12px] bg-sunken px-3.5 text-[14px] font-medium text-ink"
        >
          +250
        </button>
        <button
          type="button"
          onClick={() => bump(500)}
          className="tap tnum h-11 shrink-0 rounded-[12px] bg-sunken px-3.5 text-[14px] font-medium text-ink"
        >
          +500
        </button>
      </div>
      <Bar value={value / Math.max(1, targetMl)} color="var(--c-sky)" height={4} className="mt-2.5" delay={0.15} />
    </div>
  );
}
