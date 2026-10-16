"use client";

import { Dumbbell, Loader2, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration, formatLongDate, relativeDay } from "@/lib/dates";
import { coveredMinutes } from "@/lib/schedule";
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
  const { openNew } = usePlan();
  const live = blocks.filter((b) => !b.skippedAt);
  const planned = coveredMinutes(live);
  const done = live.filter((b) => b.doneAt).length;
  const rel = relativeDay(date, today);
  const long = formatLongDate(date);

  return (
    <section className="mt-5">
      <div className="mb-1 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink">
            {rel === "Today" || rel === "Tomorrow" || rel === "Yesterday" ? rel : long.split(",")[0]}
          </h2>
          <p className="tnum truncate text-[13px] text-ink-3">
            {rel === "Today" || rel === "Tomorrow" || rel === "Yesterday" ? long : long.split(", ").slice(1).join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live.length > 0 && (
            <span className="tnum text-[13px] text-ink-3">
              {formatDuration(planned)} planned{done > 0 && ` · ${done}/${live.length} done`}
            </span>
          )}
          <button
            type="button"
            aria-label="Add block"
            onClick={() => openNew({ date, start: 9 * 60, end: 10 * 60 })}
            className="tap grid size-9 place-items-center rounded-full bg-sunken text-ink"
          >
            <Plus className="size-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {ghost && ghost.startMin == null && <UntimedGhost ghost={ghost} />}

      {live.length === 0 && !ghost && (
        <p className="mt-2 px-1 text-[13.5px] text-ink-3">Nothing planned. Tap an hour to block time for a goal.</p>
      )}

      <TimeGrid
        columns={[{ date, blocks, ghost }]}
        range={range}
        hourPx={64}
        today={today}
        timezone={timezone}
        autoScroll
      />
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
