"use client";

import { ArrowRight, Ellipsis, Gauge, Pencil, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { Season } from "@/db/schema";
import { GoalSheet, SeasonSheet } from "./goal-sheets";

type Strength = { score: number; label: string; tips: string[] };

const strengthColor = (score: number) => (score >= 65 ? "var(--ok)" : "var(--warn)");

const itemCls =
  "tap flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-ink active:bg-sunken [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-ink-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line";

function MenuButton({ icon, children, value, onClick }: { icon: ReactNode; children: ReactNode; value?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={itemCls}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {value != null && <span className="tnum shrink-0 text-[14px] font-normal text-ink-3">{value}</span>}
    </button>
  );
}

/** The season's one quiet control: add a goal, plan strength, edit, start over. */
export function SeasonMenu({ season, strength, endDateLabel }: { season: Season; strength: Strength | null; endDateLabel: string }) {
  const [mode, setMode] = useState<null | "menu" | "edit" | "goal" | "strength">(null);
  const close = () => setMode(null);
  return (
    <>
      <Button variant="secondary" size="icon" aria-label="Season options" onClick={() => setMode("menu")}>
        <Ellipsis className="size-5" strokeWidth={2.2} />
      </Button>
      <Sheet open={mode === "menu"} onClose={close} title={season.name}>
        <div className="card overflow-hidden">
          <MenuButton icon={<Plus />} onClick={() => setMode("goal")}>
            New goal
          </MenuButton>
          {strength && (
            <MenuButton icon={<Gauge />} onClick={() => setMode("strength")} value={`${strength.score} · ${strength.label}`}>
              Plan strength
            </MenuButton>
          )}
          <MenuButton icon={<Pencil />} onClick={() => setMode("edit")}>
            Edit season
          </MenuButton>
          <Link href="/app/goals/setup" className={itemCls}>
            <RotateCcw />
            <span className="min-w-0 flex-1 truncate">Start a new season</span>
          </Link>
        </div>
        <p className="mt-3 px-1 text-[12.5px] text-ink-3">A new season archives this one.</p>
      </Sheet>
      <SeasonSheet open={mode === "edit"} onClose={close} season={season} />
      <GoalSheet open={mode === "goal"} onClose={close} endDateLabel={endDateLabel} />
      {strength && <PlanStrengthSheet open={mode === "strength"} onClose={close} strength={strength} />}
    </>
  );
}

function PlanStrengthSheet({ open, onClose, strength }: { open: boolean; onClose: () => void; strength: Strength }) {
  const color = strengthColor(strength.score);
  return (
    <Sheet open={open} onClose={onClose} title="Plan strength" description="How realistic this season looks.">
      <div className="flex items-center gap-4 pt-1 pb-5">
        <ProgressRing value={strength.score / 100} size={64} stroke={6} color={color}>
          <span className="tnum text-[18px] font-semibold tracking-tight text-ink">{strength.score}</span>
        </ProgressRing>
        <div>
          <div className="display text-[24px] text-ink">{strength.label}</div>
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
        <p className="rounded-[12px] bg-ok-soft px-4 py-3.5 text-[14.5px] font-medium text-ok">Nothing to fix. Keep going.</p>
      )}
      <p className="mt-5 px-1 text-[12.5px] leading-relaxed text-ink-3">
        Scores up to 3 core goals, clear outcomes, milestones, weekly steps, hours that fit your capacity and time blocked this week.
      </p>
    </Sheet>
  );
}

/** Quiet last row of the goals list. */
export function AddGoalRow({ endDateLabel }: { endDateLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-row flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[14.5px] font-medium text-ink-2 hover:text-ink"
      >
        <span className="-ml-[3px] flex w-4 shrink-0 justify-center">
          <Plus className="size-4" strokeWidth={2.2} />
        </span>
        Add a goal
      </button>
      <GoalSheet open={open} onClose={() => setOpen(false)} endDateLabel={endDateLabel} />
    </>
  );
}
