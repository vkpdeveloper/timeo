"use client";

import { ArrowRight, Ellipsis, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { Season } from "@/db/schema";
import { SeasonSheet } from "./goal-sheets";

type Strength = { score: number; label: string; tips: string[] };

const strengthColor = (score: number) =>
  score >= 65 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--bad)";

export function PlanStrengthChip({ strength }: { strength: Strength }) {
  const [open, setOpen] = useState(false);
  const color = strengthColor(strength.score);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap -my-1 -mr-1.5 inline-flex h-9 items-center gap-2 rounded-full bg-sunken py-1 pr-3 pl-1.5"
      >
        <ProgressRing value={strength.score / 100} size={24} stroke={3.5} color={color} track="var(--line-strong)" />
        <span className="text-[12.5px] font-semibold text-ink">
          <span className="font-medium text-ink-3">Plan </span>
          {strength.label}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Plan strength" description="How realistic this season looks.">
        <div className="flex items-center gap-4 pt-1 pb-5">
          <ProgressRing value={strength.score / 100} size={72} stroke={7} color={color}>
            <span className="tnum text-[20px] font-semibold tracking-tight text-ink">{strength.score}</span>
          </ProgressRing>
          <div>
            <div className="display text-[30px] text-ink">{strength.label}</div>
            <p className="text-[13.5px] text-ink-3">Out of 100</p>
          </div>
        </div>
        {strength.tips.length > 0 ? (
          <>
            <div className="eyebrow mb-2 px-1">To make it stronger</div>
            <ul className="card overflow-hidden">
              {strength.tips.map((tip) => (
                <li key={tip} className="flex items-center gap-3 px-4 py-3.5 text-[15px] text-ink [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
                  <ArrowRight className="size-4 shrink-0 text-ink-3" />
                  {tip}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-2xl bg-ok-soft px-4 py-3.5 text-[14.5px] font-medium text-ok">Nothing to fix. Keep going.</p>
        )}
        <p className="mt-5 px-1 text-[12.5px] leading-relaxed text-ink-3">
          Scores up to 3 core goals, clear outcomes, milestones, weekly steps, hours that fit your capacity and time blocked this week.
        </p>
      </Sheet>
    </>
  );
}

export function SeasonMenu({ season }: { season: Season }) {
  const [mode, setMode] = useState<null | "menu" | "edit">(null);
  return (
    <>
      <Button variant="secondary" size="icon" aria-label="Season options" onClick={() => setMode("menu")}>
        <Ellipsis className="size-5" strokeWidth={2.2} />
      </Button>
      <Sheet open={mode === "menu"} onClose={() => setMode(null)} title={season.name}>
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="tap flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left text-[15px] font-medium text-ink active:bg-sunken"
          >
            <Pencil className="size-[18px] text-ink-3" /> Edit season
          </button>
          <Link
            href="/goals/setup"
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-ink active:bg-sunken"
          >
            <RotateCcw className="size-[18px] text-ink-3" /> Start a new season
          </Link>
        </div>
        <p className="mt-3 px-1 text-[12.5px] text-ink-3">A new season archives this one.</p>
      </Sheet>
      <SeasonSheet open={mode === "edit"} onClose={() => setMode(null)} season={season} />
    </>
  );
}
