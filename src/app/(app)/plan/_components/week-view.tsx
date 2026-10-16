"use client";

import { Check, Dumbbell, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { dayOfMonth, formatDuration, formatMin, formatWeekdayShort } from "@/lib/dates";
import { coveredMinutes } from "@/lib/schedule";
import { addScheduledWorkout } from "../actions";
import { blockColors, KIND_ICON, KIND_LABEL } from "./block-style";
import { planHref } from "./plan-header";
import { usePlan } from "./plan-provider";
import { TimeGrid } from "./time-grid";
import type { Ghost, PlanBlock } from "./types";

type SummaryGoal = { id: string; title: string; color: string; targetMin: number; plannedMin: number };

export function WeekSummary({ goals }: { goals: SummaryGoal[] }) {
  if (goals.length === 0) return null;
  const planned = goals.reduce((s, g) => s + g.plannedMin, 0);
  const target = goals.reduce((s, g) => s + g.targetMin, 0);
  return (
    <section className="card mt-5 px-4 pt-3.5 pb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Goal time this week</h2>
        <span className="tnum text-[13px] text-ink-3">
          <span className="font-semibold text-ink">{formatDuration(planned)}</span> of {formatDuration(target)}
        </span>
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {goals.map((g) => {
          const pct = g.targetMin > 0 ? g.plannedMin / g.targetMin : 0;
          return (
            <li key={g.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
                  <span className="truncate font-medium text-ink">{g.title}</span>
                </span>
                <span className={cn("tnum shrink-0", pct >= 1 ? "font-semibold text-ok" : "text-ink-3")}>
                  {formatDuration(g.plannedMin)} / {formatDuration(g.targetMin)}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(1, pct) * 100}%`,
                    background: colorVar(g.color),
                    transition: "width 600ms cubic-bezier(0.32,0.72,0,1)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WeekView({
  days,
  today,
  timezone,
  range,
  blocks,
  ghosts,
}: {
  days: string[];
  today: string;
  timezone: string;
  range: { start: number; end: number };
  blocks: PlanBlock[];
  ghosts: Ghost[];
}) {
  return (
    <>
      <div className="lg:hidden">
        <WeekAgenda days={days} today={today} blocks={blocks} ghosts={ghosts} />
      </div>
      <div className="hidden lg:block">
        <WeekGrid days={days} today={today} timezone={timezone} range={range} blocks={blocks} ghosts={ghosts} />
      </div>
    </>
  );
}

function WeekAgenda({ days, today, blocks, ghosts }: { days: string[]; today: string; blocks: PlanBlock[]; ghosts: Ghost[] }) {
  const { openBlock, openNew } = usePlan();
  return (
    <div className="mt-6 space-y-6">
      {days.map((d) => {
        const list = blocks.filter((b) => b.date === d);
        const live = list.filter((b) => !b.skippedAt);
        const ghost = ghosts.find((g) => g.date === d);
        const isToday = d === today;
        return (
          <section key={d}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <Link href={planHref(d, "day", today)} className="tap flex items-baseline gap-2">
                <span className={cn("text-[15px] font-semibold tracking-tight", isToday ? "text-accent" : "text-ink")}>
                  {formatWeekdayShort(d)}
                </span>
                <span className="tnum text-[13px] text-ink-3">{dayOfMonth(d)}</span>
                {isToday && <span className="text-[12px] font-semibold text-accent">Today</span>}
              </Link>
              <span className="tnum text-[12.5px] text-ink-3">
                {live.length ? `${formatDuration(coveredMinutes(live))} planned` : ""}
              </span>
            </div>
            {list.length === 0 && !ghost ? (
              <button
                type="button"
                onClick={() => openNew({ date: d, start: 9 * 60, end: 10 * 60 })}
                className="tap flex h-12 w-full items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 text-[13.5px] text-ink-3"
              >
                <Plus className="size-4" /> Nothing planned
              </button>
            ) : (
              <div className="card overflow-hidden">
                {mergeByTime(list, ghost).map((item) =>
                  "id" in item ? (
                    <AgendaRow key={item.id} block={item} onOpen={() => openBlock(item)} />
                  ) : (
                    <GhostRow key="ghost" ghost={item} />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function mergeByTime(list: PlanBlock[], ghost: Ghost | undefined): (PlanBlock | Ghost)[] {
  if (!ghost) return list;
  const at = ghost.startMin ?? 24 * 60;
  const i = list.findIndex((b) => b.startMin > at);
  return i === -1 ? [...list, ghost] : [...list.slice(0, i), ghost, ...list.slice(i)];
}

function AgendaRow({ block: b, onOpen }: { block: PlanBlock; onOpen: () => void }) {
  const c = blockColors(b.color);
  const Icon = KIND_ICON[b.kind];
  const done = !!b.doneAt;
  const skipped = !!b.skippedAt;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-sunken [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
    >
      <span className="tnum w-[52px] shrink-0 text-[12.5px] leading-tight">
        <span className="block font-medium text-ink-2">{formatMin(b.startMin, true)}</span>
        <span className="block text-ink-3">{formatDuration(b.endMin - b.startMin)}</span>
      </span>
      <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: c.bar }} />
      <span className={cn("min-w-0 flex-1", (done || skipped) && "opacity-55")}>
        <span className={cn("block truncate text-[14px] font-medium text-ink", skipped && "line-through decoration-ink-3")}>
          {b.title}
        </span>
        <span className="flex items-center gap-1 truncate text-[12px] text-ink-3">
          {!b.goalTitle && <Icon className="size-3 shrink-0" />}
          {b.goalTitle ?? KIND_LABEL[b.kind]}
          {b.rescheduleCount >= 2 && <span className="text-warn"> · moved {b.rescheduleCount}×</span>}
        </span>
      </span>
      {done && <Check className="size-4 shrink-0" style={{ color: c.ink }} strokeWidth={2.6} />}
    </button>
  );
}

function GhostRow({ ghost }: { ghost: Ghost }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex w-full items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <span className="tnum w-[52px] shrink-0 text-[12.5px] leading-tight">
        <span className="block font-medium text-ink-3">{ghost.startMin != null ? formatMin(ghost.startMin, true) : "Gym"}</span>
        <span className="block text-ink-3">{formatDuration(ghost.durationMin)}</span>
      </span>
      <span
        className="h-8 w-[3px] shrink-0 rounded-full"
        style={{ background: `repeating-linear-gradient(${colorVar(ghost.color)} 0 3px, transparent 3px 6px)` }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[14px] font-medium" style={{ color: colorVar(ghost.color) }}>
          <Dumbbell className="size-3.5 shrink-0" />
          {ghost.name}
        </span>
        <span className="block text-[12px] text-ink-3">From your gym split</span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => addScheduledWorkout(ghost.date))}
        className="tap inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold"
        style={{ background: softVar(ghost.color), color: colorVar(ghost.color) }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
      </button>
    </div>
  );
}

function WeekGrid({
  days,
  today,
  timezone,
  range,
  blocks,
  ghosts,
}: {
  days: string[];
  today: string;
  timezone: string;
  range: { start: number; end: number };
  blocks: PlanBlock[];
  ghosts: Ghost[];
}) {
  return (
    <div className="card mt-6 overflow-hidden px-2 pb-2">
      <div className="flex pt-3 pb-2" style={{ paddingLeft: 40 }}>
        {days.map((d) => {
          const live = blocks.filter((b) => b.date === d && !b.skippedAt);
          return (
            <Link key={d} href={planHref(d, "day", today)} className="tap min-w-0 flex-1 text-center">
              <div className={cn("text-[11px] font-semibold tracking-wide uppercase", d === today ? "text-accent" : "text-ink-3")}>
                {formatWeekdayShort(d)}
              </div>
              <div className={cn("tnum text-[18px] font-semibold", d === today ? "text-accent" : "text-ink")}>{dayOfMonth(d)}</div>
              <div className="tnum text-[11px] text-ink-3">{live.length ? formatDuration(coveredMinutes(live)) : "–"}</div>
            </Link>
          );
        })}
      </div>
      <TimeGrid
        compact
        columns={days.map((d) => ({
          date: d,
          blocks: blocks.filter((b) => b.date === d),
          ghost: ghosts.find((g) => g.date === d) ?? null,
        }))}
        range={range}
        hourPx={44}
        today={today}
        timezone={timezone}
      />
    </div>
  );
}
