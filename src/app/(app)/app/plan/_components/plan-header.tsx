"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, type PanInfo } from "motion/react";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { Segmented } from "@/components/ui/controls";
import { springs } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { addDays, dayOfMonth, diffDays, formatWeekdayShort, startOfWeek, toUTCDate, weekDays, WEEKDAY_LETTER } from "@/lib/dates";
import { type Capacity, capacityText, type DayLoad } from "./capacity";
import type { PlanView } from "./types";

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export const planHref = (date: string, view: PlanView, today?: string) => {
  const params = new URLSearchParams();
  if (date !== today) params.set("date", date);
  if (view === "week") params.set("view", "week");
  const q = params.toString();
  return q ? `/app/plan?${q}` : "/app/plan";
};

/** "Oct 19 – 25", or "Oct 26 – Nov 1" across a month. */
function rangeLabel(weekStart: string) {
  const a = toUTCDate(weekStart);
  const b = toUTCDate(addDays(weekStart, 6));
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${monthDay.format(a)} – ${b.getUTCDate()}`
    : `${monthDay.format(a)} – ${monthDay.format(b)}`;
}

function seasonWeek(season: { startDate: string; endDate: string } | null, weekStart: string) {
  if (!season) return null;
  // the season week that holds most of this calendar week (its Thursday)
  const mid = addDays(weekStart, 3);
  if (mid < season.startDate || mid > season.endDate) return null;
  const total = Math.ceil((diffDays(season.endDate, season.startDate) + 1) / 7);
  return `Week ${Math.floor(diffDays(mid, season.startDate) / 7) + 1} of ${total}`;
}

export function PlanHeader({
  date,
  today,
  view,
  season,
  loads,
  caps,
  weekCap,
}: {
  date: string;
  today: string;
  view: PlanView;
  season: { startDate: string; endDate: string } | null;
  loads: Record<string, DayLoad>;
  caps: Record<string, Capacity>;
  weekCap: Capacity;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [state, setState] = useOptimistic({ date, view });
  const dragged = useRef(false);

  const go = (d: string, v: PlanView = state.view) =>
    start(() => {
      setState({ date: d, view: v });
      router.push(planHref(d, v, today), { scroll: false });
    });

  const weekStart = startOfWeek(state.date);
  const days = weekDays(weekStart);
  const inThisWeek = startOfWeek(today) === weekStart;
  const atToday = state.view === "day" ? state.date === today : inThisWeek;
  const week = seasonWeek(season, weekStart);

  // known only for the week the server rendered; a new week fills in when it arrives
  const sameWeek = startOfWeek(date) === weekStart;
  const dayCap = sameWeek ? caps[state.date] : undefined;
  const capLine =
    state.view === "day"
      ? dayCap && `${formatWeekdayShort(state.date)} · ${capacityText(dayCap)}`
      : sameWeek && capacityText(weekCap);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    if (Math.abs(dx) > 50 || Math.abs(info.velocity.x) > 400) {
      dragged.current = true;
      go(addDays(state.date, dx < 0 ? 7 : -7));
      setTimeout(() => (dragged.current = false), 50);
    }
  };

  return (
    <>
      <header className="pt-5 pb-3 lg:pt-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="display text-[26px] text-ink lg:text-[28px]">Week</h1>
          <div className="-my-1 flex items-center">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => go(addDays(state.date, -7))}
              className="tap grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(today)}
              disabled={atToday}
              className="tap relative h-9 rounded-full border border-line-strong px-3.5 text-[13.5px] font-medium text-ink before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:border-line disabled:text-ink-3"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => go(addDays(state.date, 7))}
              className="tap -mr-2.5 grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
        <p className="tnum mt-0.5 text-[14.5px] text-ink-3">
          {rangeLabel(weekStart)}
          {week && <> · {week}</>}
        </p>
      </header>

      <div data-week-sticky className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg px-4 pt-safe sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="overflow-hidden pt-1">
          <motion.div
            key={weekStart}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="grid touch-pan-y grid-cols-7 gap-1"
            role="tablist"
            aria-label="Days of the week"
          >
            {days.map((d, i) => (
              <RibbonDay
                key={d}
                date={d}
                letter={WEEKDAY_LETTER[i]}
                today={today}
                selected={state.view === "day" && d === state.date}
                load={sameWeek ? loads[d] : undefined}
                onSelect={() => {
                  if (!dragged.current) go(d, "day");
                }}
              />
            ))}
          </motion.div>
        </div>
        <div className="flex h-12 items-center gap-3">
          <p className="tnum min-w-0 flex-1 truncate text-[13px] text-ink-2" aria-live="polite">
            {capLine || "\u00a0"}
          </p>
          <Segmented
            size="sm"
            className="w-[112px] shrink-0"
            value={state.view}
            onChange={(v) => go(state.date, v)}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
          />
        </div>
      </div>
    </>
  );
}

const BAR_H = 32;

function RibbonDay({
  date,
  letter,
  today,
  selected,
  load,
  onSelect,
}: {
  date: string;
  letter: string;
  today: string;
  selected: boolean;
  load: DayLoad | undefined;
  onSelect: () => void;
}) {
  const isToday = date === today;
  const past = date < today;
  const parts = load?.parts ?? [];
  const span = load?.span ?? 1;
  return (
    <button
      type="button"
      role="tab"
      onClick={onSelect}
      aria-selected={selected}
      aria-label={`${formatWeekdayShort(date)} ${dayOfMonth(date)}`}
      className="tap relative flex h-[88px] flex-col items-center justify-center gap-1.5 rounded-[14px]"
    >
      {selected && (
        <motion.span
          layoutId="week-ribbon-day"
          transition={springs.snappy}
          className="absolute inset-0 rounded-[14px] border-[1.5px] border-accent bg-accent-soft"
        />
      )}
      <span className={cn("relative text-[11px] font-medium", isToday ? "text-accent" : "text-ink-3")}>{letter}</span>
      <span
        className={cn(
          "tnum relative text-[16px] leading-none font-semibold",
          isToday ? "text-accent" : past ? "text-ink-3" : "text-ink",
        )}
      >
        {dayOfMonth(date)}
      </span>
      {/* load: planned (solid, by colour) over free (the track) */}
      <span
        aria-hidden
        className="relative flex w-2 flex-col-reverse overflow-hidden rounded-full bg-line-strong"
        style={{ height: BAR_H }}
      >
        {parts.map((p, j) => (
          <motion.span
            key={j}
            className={cn("block w-full shrink-0", past && "opacity-60")}
            initial={false}
            animate={{ height: Math.max(2, Math.min(1, p.min / span) * BAR_H) }}
            transition={springs.smooth}
            style={{ background: p.color ? colorVar(p.color) : "var(--ink-2)" }}
          />
        ))}
      </span>
    </button>
  );
}
