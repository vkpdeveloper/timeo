"use client";

import { ArrowRight, Ellipsis, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressRing, Stat } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { Season } from "@/db/schema";
import { SeasonSheet } from "./goal-sheets";

type Strength = { score: number; label: string; tips: string[] };

const strengthColor = (score: number) =>
  score >= 65 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--bad)";

/** The plan strength as a Stat for the certainty strip; tap for what would make it stronger. */
export function PlanStrengthStat({ strength }: { strength: Strength }) {
  const [open, setOpen] = useState(false);
  const color = strengthColor(strength.score);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tap min-w-0 text-left" aria-label={`Plan strength ${strength.score} of 100, ${strength.label}. Show tips`}>
        <Stat
          value={
            <span className="inline-flex items-center gap-1.5">
              <ProgressRing value={strength.score / 100} size={16} stroke={3} color={color} track="var(--line-strong)" />
              {strength.score}
            </span>
          }
          label={`${strength.label} plan`}
        />
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
            <ul className="card card-list overflow-hidden">
              {strength.tips.map((tip) => (
                <li key={tip} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 text-[15px] text-ink">
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
