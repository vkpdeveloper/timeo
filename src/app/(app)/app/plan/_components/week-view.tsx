"use client";

import { Check, Dumbbell, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Row, Section } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { dayOfMonth, formatDuration, formatWeekdayShort, toTimeInput } from "@/lib/dates";
import { coveredMinutes } from "@/lib/schedule";
import { addScheduledWorkout } from "../actions";
import { blockColors, KIND_LABEL } from "./block-style";
import type { Capacity } from "./capacity";
import { planHref } from "./plan-header";
import { usePlan } from "./plan-provider";
import { TimeGrid } from "./time-grid";
import type { Ghost, PlanBlock } from "./types";

type SummaryGoal = {
  id: string;
  title: string;
  color: string;
  targetMin: number;
  plannedMin: number;
};

/** Goal time this week: planned against each goal's weekly target. */
export function WeekSummary({ goals }: { goals: SummaryGoal[] }) {
  if (goals.length === 0) return null;
  const planned = goals.reduce((s, g) => s + g.plannedMin, 0);
  const target = goals.reduce((s, g) => s + g.targetMin, 0);
  return (
    <Section
      title="Goal time"
      action={
        <span className="tnum font-normal">
          <span className="font-medium text-ink">{formatDuration(planned)}</span> of {formatDuration(target)}
        </span>
      }
      className="mt-8!"
    >
      <ul className="card grid gap-x-8 gap-y-3.5 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const pct = g.targetMin > 0 ? g.plannedMin / g.targetMin : 0;
          return (
            <li key={g.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
                  <span className="truncate font-medium text-ink-2">{g.title}</span>
                </span>
                <span className={cn("tnum shrink-0", pct >= 1 ? "font-medium text-ink" : "text-ink-3")}>
                  {formatDuration(g.plannedMin)} / {formatDuration(g.targetMin)}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
                <div
                  className="meter-grow h-full rounded-full"
                  style={{ width: `${Math.min(1, pct) * 100}%`, background: colorVar(g.color) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function WeekView({
  days,
  today,
  timezone,
  range,
  blocks,
  ghosts,
  caps,
}: {
  days: string[];
  today: string;
  timezone: string;
  range: { start: number; end: number };
  blocks: PlanBlock[];
  ghosts: Ghost[];
  caps: Record<string, Capacity>;
}) {
  return (
    <>
      <div className="lg:hidden">
        <WeekList days={days} today={today} blocks={blocks} ghosts={ghosts} caps={caps} />
      </div>
      <div className="hidden lg:block">
        <WeekGrid days={days} today={today} timezone={timezone} range={range} blocks={blocks} ghosts={ghosts} />
      </div>
    </>
  );
}

/** Mobile: a compact list per day. Days that are over fold into one "Earlier" group. */
function WeekList({
  days,
  today,
  blocks,
  ghosts,
  caps,
}: {
  days: string[];
  today: string;
  blocks: PlanBlock[];
  ghosts: Ghost[];
  caps: Record<string, Capacity>;
}) {
  const { openBlock, openNew } = usePlan();
  const past = days.filter((d) => d < today);
  const ahead = days.filter((d) => d >= today);
  return (
    <div className="stagger mt-4">
      {past.length > 0 && (
        <Section title="Earlier" card>
          {past.map((d) => {
            const c = caps[d];
            return (
              <Row
                key={d}
                href={planHref(d, "day", today)}
                title={
                  <span className="flex items-baseline gap-2">
                    {formatWeekdayShort(d)}
                    <span className="tnum text-[13px] font-normal text-ink-3">{dayOfMonth(d)}</span>
                  </span>
                }
                value={c?.count ? `${formatDuration(c.plannedTotal)}, ${c.done} of ${c.count} done` : "Nothing planned"}
              />
            );
          })}
        </Section>
      )}
      {ahead.map((d) => {
        const list = blocks.filter((b) => b.date === d);
        const ghost = ghosts.find((g) => g.date === d);
        const isToday = d === today;
        const c = caps[d];
        const empty = list.length === 0 && !ghost;
        return (
          <Section
            key={d}
            title={
              <Link href={planHref(d, "day", today)} className="tap inline-flex items-baseline gap-2">
                <span className={isToday ? "text-accent" : undefined}>{isToday ? "Today" : formatWeekdayShort(d)}</span>
                <span className="tnum text-[13px] font-normal text-ink-3">
                  {isToday ? `${formatWeekdayShort(d)} ${dayOfMonth(d)}` : dayOfMonth(d)}
                </span>
              </Link>
            }
            action={
              c && c.plannedTotal > 0 ? (
                <span className="tnum text-[12.5px] font-normal">
                  {formatDuration(c.plannedTotal)} planned, {formatDuration(c.freeMin)} free
                </span>
              ) : undefined
            }
            card={!empty}
          >
            {empty ? (
              <button
                type="button"
                onClick={() => openNew({ date: d, start: 9 * 60, end: 10 * 60 })}
                className="tap flex h-12 w-full items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 text-[13.5px] text-ink-3"
              >
                <Plus className="size-4" /> Nothing planned. Add a block
              </button>
            ) : (
              mergeByTime(list, ghost).map((item) =>
                "id" in item ? (
                  <ListRow key={item.id} block={item} onOpen={() => openBlock(item)} />
                ) : (
                  <GhostRow key="ghost" ghost={item} />
                ),
              )
            )}
          </Section>
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

function ListRow({ block: b, onOpen }: { block: PlanBlock; onOpen: () => void }) {
  const c = blockColors(b.color);
  const done = !!b.doneAt;
  const skipped = !!b.skippedAt;
  return (
    <button type="button" onClick={onOpen} className="tap-row flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left">
      <span className={cn("w-[46px] shrink-0 leading-tight", (done || skipped) && "opacity-60")}>
        <span className="mono block text-[12.5px] text-ink-2">{toTimeInput(b.startMin)}</span>
        <span className="tnum block text-[11.5px] text-ink-3">{formatDuration(b.endMin - b.startMin)}</span>
      </span>
      <span
        className={cn("h-8 w-[3px] shrink-0 rounded-full", (done || skipped) && "opacity-50")}
        style={{ background: skipped ? "var(--line-strong)" : c.bar }}
      />
      <span className={cn("min-w-0 flex-1", (done || skipped) && "opacity-60")}>
        <span className={cn("block truncate text-[14px] font-medium text-ink", skipped && "line-through decoration-ink-3")}>
          {b.title}
        </span>
        <span className="block truncate text-[12px] text-ink-3">
          {b.goalTitle ?? KIND_LABEL[b.kind]}
          {b.rescheduleCount >= 2 && <span className="text-warn">, moved {b.rescheduleCount}×</span>}
        </span>
      </span>
      {done && <Check className="size-4 shrink-0 text-ink-3" strokeWidth={2.4} />}
    </button>
  );
}

function GhostRow({ ghost }: { ghost: Ghost }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2">
      <span className="w-[46px] shrink-0 leading-tight">
        <span className="mono block text-[12.5px] text-ink-3">{ghost.startMin != null ? toTimeInput(ghost.startMin) : "Gym"}</span>
        <span className="tnum block text-[11.5px] text-ink-3">{formatDuration(ghost.durationMin)}</span>
      </span>
      <span className="h-8 w-[3px] shrink-0 rounded-full border border-dashed" style={{ borderColor: colorVar(ghost.color) }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink">
          <Dumbbell className="size-3.5 shrink-0" style={{ color: colorVar(ghost.color) }} />
          {ghost.name}
        </span>
        <span className="block text-[12px] text-ink-3">From your gym split</span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => addScheduledWorkout(ghost.date))}
        className="tap inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold"
        style={{ background: softVar(ghost.color), color: colorVar(ghost.color) }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
      </button>
    </div>
  );
}

/** Desktop: seven columns on one time grid. Blocks can be dragged across days. */
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
    <div className="mt-4">
      <div className="flex pb-1" style={{ paddingLeft: 40 }}>
        {days.map((d) => {
          const live = blocks.filter((b) => b.date === d && !b.skippedAt);
          const isToday = d === today;
          return (
            <Link
              key={d}
              href={planHref(d, "day", today)}
              className="tap min-w-0 flex-1 rounded-[10px] py-1 text-center hover:bg-surface-2"
            >
              <div className={cn("tnum text-[12.5px] font-medium", isToday ? "text-accent" : "text-ink-2")}>
                {formatWeekdayShort(d)} {dayOfMonth(d)}
              </div>
              <div className="tnum text-[11.5px] text-ink-3">{live.length ? formatDuration(coveredMinutes(live)) : "–"}</div>
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
