"use client";

import { Droplet } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { addWater } from "@/actions/health";
import { ProgressBar } from "@/components/ui/primitives";

const fmtL = (ml: number) => String(Math.round(ml / 10) / 100);

export function WaterCard({ ml, targetMl, day }: { ml: number; targetMl: number; day: string }) {
  const [value, add] = useOptimistic(ml, (v, d: number) => Math.max(0, v + d));
  const [, start] = useTransition();
  const bump = (d: number) =>
    start(async () => {
      add(d);
      await addWater(d, day);
    });
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--c-sky-soft)] text-[var(--c-sky)]">
          <Droplet className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink-3">Water</div>
          <div className="tnum text-[17px] font-semibold tracking-tight text-ink">
            {fmtL(value)}
            <span className="text-[13px] font-medium text-ink-3"> / {fmtL(targetMl)} L</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bump(250)}
            className="tap h-11 rounded-full bg-sunken px-4 text-[14px] font-semibold text-ink"
          >
            +250
          </button>
          <button
            type="button"
            onClick={() => bump(500)}
            className="tap h-11 rounded-full bg-sunken px-4 text-[14px] font-semibold text-ink"
          >
            +500
          </button>
        </div>
      </div>
      <ProgressBar value={value / Math.max(1, targetMl)} color="var(--c-sky)" className="mt-3.5" />
      {value > 0 && (
        <button
          type="button"
          onClick={() => bump(-250)}
          className="tap mt-2 text-[12px] font-medium text-ink-3"
        >
          Undo 250 ml
        </button>
      )}
    </div>
  );
}
