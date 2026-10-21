"use client";

import { Plus, Scale } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { addWater } from "@/actions/health";
import { openAsk } from "@/components/shell/ask";
import { LinearProgress, RowIcon } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { fmtKg } from "@/lib/fitness-math";
import { Sparkline } from "./charts";

const n = (v: number) => v.toLocaleString("en-US");
const litres = (ml: number) => String(Math.round(ml / 100) / 10);

/** Today's food in one block: kcal against the target, protein, water, and one way to add a meal. */
export function FoodCard({
  kcal,
  kcalTarget,
  protein,
  proteinTarget,
  waterMl,
  waterTargetMl,
  day,
}: {
  kcal: number;
  kcalTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterTargetMl: number;
  day: string;
}) {
  const [water, addOptimistic] = useOptimistic(waterMl, (v, d: number) => Math.max(0, v + d));
  const [, start] = useTransition();
  const bump = (d: number) =>
    start(async () => {
      addOptimistic(d);
      await addWater(d, day);
    });
  const left = kcalTarget != null ? kcalTarget - kcal : null;
  const over = left != null && left < 0;

  return (
    <div className="card rise overflow-hidden">
      <Link href="/app/fitness/nutrition" className="tap-row block px-4 pt-4 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="tnum text-[28px] leading-none font-semibold tracking-tight text-ink">{n(kcal)}</span>
            <span className="tnum truncate text-[14px] text-ink-3">{kcalTarget != null ? `of ${n(kcalTarget)} kcal` : "kcal"}</span>
          </div>
          <span className={cn("tnum shrink-0 text-[14px]", over ? "text-warn" : "text-ink-2")}>
            {left == null ? "No target" : over ? `${n(-left)} over` : `${n(left)} left`}
          </span>
        </div>
        <LinearProgress
          value={kcalTarget ? kcal / kcalTarget : 0}
          color={over ? "var(--warn)" : "var(--accent)"}
          height={6}
          className="mt-3"
        />
      </Link>

      <div className="grid grid-cols-2 border-t border-line">
        <Link href="/app/fitness/nutrition" className="tap-row block min-w-0 px-4 py-3">
          <div className="text-[13px] text-ink-3">Protein</div>
          <div className="tnum mt-0.5 truncate text-[15px] font-medium text-ink">
            {protein}
            <span className="font-normal text-ink-3">{proteinTarget != null ? ` / ${proteinTarget} g` : " g"}</span>
          </div>
          <LinearProgress value={proteinTarget ? protein / proteinTarget : 0} color="var(--c-teal)" height={3} className="mt-2" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 border-l border-line py-3 pr-2 pl-4">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ink-3">Water</div>
            <div className="tnum mt-0.5 truncate text-[15px] font-medium text-ink">
              {litres(water)}
              <span className="font-normal text-ink-3"> / {litres(waterTargetMl)} L</span>
            </div>
            <LinearProgress value={water / Math.max(1, waterTargetMl)} color="var(--c-sky)" height={3} className="mt-2" />
          </div>
          <button
            type="button"
            onClick={() => bump(250)}
            aria-label="Add 250 ml of water"
            className="tap tnum grid h-11 shrink-0 place-items-center rounded-[12px] bg-sunken px-2.5 text-[13.5px] font-medium text-ink"
          >
            +250
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => openAsk("meal")}
        className="tap-row flex h-12 w-full items-center justify-center gap-2 border-t border-line text-[15px] font-medium text-ink"
      >
        <Plus className="size-4 text-ink-2" /> Log a meal
      </button>
    </div>
  );
}

/** Weight as one row: latest, change, a tiny trend, and a quick weigh-in. */
export function WeightRow({
  kg,
  delta,
  trend,
  className,
}: {
  kg: number | null;
  delta: number | null;
  trend: number[];
  className?: string;
}) {
  const change =
    delta == null ? "Weigh in to start a trend" : delta === 0 ? "Flat in 30 days" : `${delta > 0 ? "+" : "−"}${fmtKg(Math.abs(delta))} kg in 30 days`;
  return (
    <div className={cn("card rise flex items-center overflow-hidden", className)} style={{ ["--delay" as string]: "60ms" }}>
      <Link href="/app/fitness/body" className="tap-row flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 pl-4">
        <RowIcon>
          <Scale />
        </RowIcon>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-ink">Weight</div>
          <div className="tnum truncate text-[13px] text-ink-3">{change}</div>
        </div>
        {trend.length > 1 && <Sparkline values={trend} width={48} height={22} color="var(--ink-3)" className="shrink-0" />}
        <span className="tnum shrink-0 text-[15px] font-medium text-ink">
          {kg != null ? (
            <>
              {fmtKg(kg)}
              <span className="font-normal text-ink-3"> kg</span>
            </>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => openAsk("weight")}
        aria-label="Log weight"
        className="tap grid h-[60px] w-12 shrink-0 place-items-center border-l border-line text-ink-2"
      >
        <Plus className="size-[18px]" />
      </button>
    </div>
  );
}
