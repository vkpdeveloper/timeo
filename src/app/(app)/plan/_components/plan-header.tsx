"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, type PanInfo } from "motion/react";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { Segmented } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { addDays, dayOfMonth, startOfWeek, toUTCDate, weekDays, WEEKDAY_LETTER } from "@/lib/dates";
import type { PlanView } from "./types";

const monthFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" });
const monthShortFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

export const planHref = (date: string, view: PlanView, today?: string) => {
  const params = new URLSearchParams();
  if (date !== today) params.set("date", date);
  if (view === "week") params.set("view", "week");
  const q = params.toString();
  return q ? `/plan?${q}` : "/plan";
};

export function PlanHeader({
  date,
  today,
  view,
  eyebrow,
  dots,
}: {
  date: string;
  today: string;
  view: PlanView;
  eyebrow: string;
  dots: Record<string, string[]>;
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
  const weekEnd = days[6];
  const title =
    state.view === "week" && toUTCDate(weekStart).getUTCMonth() !== toUTCDate(weekEnd).getUTCMonth()
      ? `${monthShortFmt.format(toUTCDate(weekStart))} – ${monthShortFmt.format(toUTCDate(weekEnd))}`
      : monthFmt.format(toUTCDate(state.date));
  const inThisWeek = startOfWeek(today) === weekStart;
  const isToday = state.date === today;

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
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        className="pb-4"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(today)}
              disabled={state.view === "day" ? isToday : inThisWeek}
              className="tap h-9 rounded-full px-3.5 text-[13px] font-semibold text-accent disabled:text-ink-3 disabled:opacity-60"
            >
              Today
            </button>
            <Segmented
              size="sm"
              className="w-[118px]"
              value={state.view}
              onChange={(v) => go(state.date, v)}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
              ]}
            />
          </div>
        }
      />

      <div className="glass sticky top-0 z-30 -mx-4 border-b border-line px-2 pt-safe sm:-mx-6 sm:px-4 lg:mx-0 lg:rounded-b-2xl lg:border-x">
        <div className="flex items-center py-2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => go(addDays(state.date, -7))}
            className="tap grid h-14 w-8 shrink-0 place-items-center rounded-xl text-ink-3 hover:text-ink"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
          <div className="min-w-0 flex-1 overflow-hidden">
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
              className="grid touch-pan-y grid-cols-7"
            >
              {days.map((d, i) => {
                const selected = state.view === "day" && d === state.date;
                const isT = d === today;
                const dayDots = dots[d] ?? [];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      if (dragged.current) return;
                      go(d, "day");
                    }}
                    aria-label={d}
                    aria-current={selected ? "date" : undefined}
                    className="tap flex h-14 flex-col items-center justify-start gap-1 pt-0.5"
                  >
                    <span className={cn("text-[10.5px] font-semibold tracking-wide", isT ? "text-accent" : "text-ink-3")}>
                      {WEEKDAY_LETTER[i]}
                    </span>
                    <span
                      className={cn(
                        "tnum grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-semibold transition-colors",
                        selected ? (isT ? "bg-accent text-white" : "bg-ink text-bg") : isT ? "text-accent" : "text-ink",
                      )}
                    >
                      {dayOfMonth(d)}
                    </span>
                    <span className="flex h-1 items-center gap-[3px]">
                      {dayDots.map((c, j) => (
                        <span
                          key={j}
                          className="size-1 rounded-full"
                          style={{ background: c === "neutral" ? "var(--ink-3)" : colorVar(c) }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </div>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => go(addDays(state.date, 7))}
            className="tap grid h-14 w-8 shrink-0 place-items-center rounded-xl text-ink-3 hover:text-ink"
          >
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
      </div>
    </>
  );
}
