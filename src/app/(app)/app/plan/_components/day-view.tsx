"use client";

import { Dumbbell, Loader2, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { addScheduledWorkout } from "../actions";
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

      {live.length === 0 && !ghost && <p className="mt-2 mb-2 px-1 text-[13px] text-ink-3">Nothing planned. Tap an hour to block time.</p>}

      <TimeGrid columns={[{ date, blocks, ghost }]} range={range} hourPx={60} today={today} timezone={timezone} autoScroll />
    </section>
  );
}

function UntimedGhost({ ghost }: { ghost: Ghost }) {
  const [pending, start] = useTransition();
  return (
    <div
      className="rise mt-3 flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed py-2.5 pr-2.5 pl-3.5"
      style={{ borderColor: colorVar(ghost.color) }}
    >
      <Dumbbell className="size-4 shrink-0" style={{ color: colorVar(ghost.color) }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-ink">{ghost.name}</div>
        <div className="tnum text-[12px] text-ink-3">On your split today · {formatDuration(ghost.durationMin)}</div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => addScheduledWorkout(ghost.date))}
        className="tap grid size-9 place-items-center rounded-full border border-line-strong text-ink-2"
        aria-label="Add to calendar"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </button>
      <Link
        href="/app/fitness"
        className="tap inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold"
        style={{ background: softVar(ghost.color), color: colorVar(ghost.color) }}
      >
        <Play className="size-3 fill-current" /> Start
      </Link>
    </div>
  );
}
