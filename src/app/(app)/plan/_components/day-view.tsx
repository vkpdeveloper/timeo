"use client";

import { Dumbbell, Loader2, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { addScheduledWorkout } from "../actions";
import { usePlan } from "./plan-provider";
import { TimeGrid } from "./time-grid";
import type { Ghost, PlanBlock } from "./types";

export function DayView({
  date,
  today,
  timezone,
  range,
  blocks,
  ghost,
}: {
  date: string;
  today: string;
  timezone: string;
  range: { start: number; end: number };
  blocks: PlanBlock[];
  ghost: Ghost | null;
}) {
  const live = blocks.filter((b) => !b.skippedAt);

  return (
    <section className="mt-3">
      {ghost && ghost.startMin == null && <UntimedGhost ghost={ghost} />}

      {live.length === 0 && !ghost && (
        <p className="mt-3 px-1 text-[13.5px] text-ink-3">Nothing planned. Tap an hour to block time for a goal.</p>
      )}

      <TimeGrid columns={[{ date, blocks, ghost }]} range={range} hourPx={60} today={today} timezone={timezone} autoScroll />
    </section>
  );
}

function UntimedGhost({ ghost }: { ghost: Ghost }) {
  const [pending, start] = useTransition();
  return (
    <div
      className="mt-3 flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed px-3.5 py-2.5"
      style={{
        borderColor: `color-mix(in oklab, ${colorVar(ghost.color)} 50%, transparent)`,
        background: `color-mix(in oklab, ${softVar(ghost.color)} 45%, transparent)`,
      }}
    >
      <Dumbbell className="size-4 shrink-0" style={{ color: colorVar(ghost.color) }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-ink">{ghost.name}</div>
        <div className="text-[12px] text-ink-3">On your split today · {formatDuration(ghost.durationMin)}</div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => addScheduledWorkout(ghost.date))}
        className="tap grid size-8 place-items-center rounded-full bg-surface text-ink-2"
        aria-label="Add to calendar"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </button>
      <Link
        href="/fitness"
        className="tap inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-white"
        style={{ background: colorVar(ghost.color) }}
      >
        <Play className="size-3 fill-current" /> Start
      </Link>
    </div>
  );
}

/** The "+" on the capacity bar: a new one-hour block at 9am on the open day. */
export function AddBlockButton({ date }: { date: string }) {
  const { openNew } = usePlan();
  return (
    <button
      type="button"
      aria-label="Add block"
      onClick={() => openNew({ date, start: 9 * 60, end: 10 * 60 })}
      className="tap relative grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink before:absolute before:-inset-1.5 before:content-['']"
    >
      <Plus className="size-4" strokeWidth={2.4} />
    </button>
  );
}
