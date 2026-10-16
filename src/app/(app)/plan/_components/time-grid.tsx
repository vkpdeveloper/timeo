"use client";

import { Check, Dumbbell, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { layoutColumns } from "@/lib/calendar-layout";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration, formatMin, nowMinIn } from "@/lib/dates";
import { addScheduledWorkout } from "../actions";
import { blockVars, KIND_ICON } from "./block-style";
import { usePlan } from "./plan-provider";
import type { Ghost, PlanBlock } from "./types";

const SNAP = 15;

/** Minutes since midnight in the user's timezone, updated every minute. Null before mount. */
export function useNowMin(timezone: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowMinIn(timezone));
    tick();
    let interval: ReturnType<typeof setInterval> | undefined;
    // align to the start of the next minute, then tick every minute
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [timezone]);
  return now;
}

export type GridColumn = { date: string; blocks: PlanBlock[]; ghost: Ghost | null };

export function TimeGrid({
  columns,
  range,
  hourPx,
  today,
  timezone,
  compact = false,
  autoScroll = false,
}: {
  columns: GridColumn[];
  range: { start: number; end: number };
  hourPx: number;
  today: string;
  timezone: string;
  /** Narrow columns (week grid): smaller type, fewer details. */
  compact?: boolean;
  autoScroll?: boolean;
}) {
  const { openNew, openBlock, draft } = usePlan();
  const now = useNowMin(timezone);
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const pxPerMin = hourPx / 60;
  const height = (range.end - range.start) * pxPerMin;
  const y = (min: number) => (min - range.start) * pxPerMin;
  const hours: number[] = [];
  for (let h = range.start; h <= range.end; h += 60) hours.push(h);
  const todayCol = columns.findIndex((c) => c.date === today);

  // Bring "now" (or the first block) into view when the day opens.
  useEffect(() => {
    if (!autoScroll || scrolled.current || !ref.current) return;
    const col = columns[0];
    const isToday = col?.date === today;
    if (isToday && now == null) return;
    scrolled.current = true;
    const first = col?.blocks.find((b) => !b.skippedAt)?.startMin;
    const target = isToday ? now! : first ?? null;
    if (target == null) return;
    const top = ref.current.getBoundingClientRect().top + window.scrollY + y(target);
    if (top - window.scrollY > window.innerHeight * 0.6) {
      window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.32), behavior: "instant" });
    }
  });

  const onTap = (date: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const min = range.start + (e.clientY - rect.top) / pxPerMin;
    const start = Math.max(range.start, Math.min(range.end - SNAP, Math.floor(min / SNAP) * SNAP));
    openNew({ date, start, end: Math.min(24 * 60, start + 60) });
  };

  const gutter = compact ? 40 : 48;

  return (
    <div ref={ref} className="relative select-none" style={{ height: height + 16, paddingTop: 8 }}>
      <div className="relative" style={{ height }}>
        {/* hour lines and labels */}
        {hours.map((h) => (
          <div key={h} className="pointer-events-none absolute right-0 left-0" style={{ top: y(h) }}>
            <div className="absolute border-t border-line" style={{ left: gutter, right: 0 }} />
            {h < range.end && (
              <div
                className="absolute border-t border-dashed border-line opacity-60"
                style={{ left: gutter, right: 0, top: hourPx / 2 }}
              />
            )}
            <span
              className="tnum absolute -translate-y-1/2 pr-2 text-right text-[10.5px] font-medium text-ink-3"
              style={{ width: gutter }}
            >
              {formatMin(h % (24 * 60), true).replace(/(am|pm)$/, (s) => " " + s.toUpperCase())}
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 flex" style={{ left: gutter }}>
          {columns.map((col, ci) => {
            const placed = layoutColumns(col.blocks);
            const showDraft = draft && draft.date === col.date;
            return (
              <div
                key={col.date}
                className={cn(
                  "relative min-w-0 flex-1 cursor-pointer",
                  columns.length > 1 && "border-l border-line",
                  columns.length > 1 && ci === todayCol && "bg-accent-soft/40",
                )}
                onClick={(e) => onTap(col.date, e)}
              >
                {col.ghost && col.ghost.startMin != null && (
                  <GhostBlock ghost={col.ghost} top={y(col.ghost.startMin)} height={col.ghost.durationMin * pxPerMin} compact={compact} />
                )}
                {placed.map(({ item: b, col: c, cols }) => (
                  <BlockCard
                    key={b.id}
                    block={b}
                    compact={compact}
                    onOpen={() => openBlock(b)}
                    style={{
                      top: y(b.startMin) + 1,
                      height: Math.max(compact ? 18 : 22, (b.endMin - b.startMin) * pxPerMin - 2),
                      left: `calc(${(c / cols) * 100}% + ${compact ? 2 : 3}px)`,
                      width: `calc(${100 / cols}% - ${compact ? 4 : 6}px)`,
                    }}
                    live={col.date === today && now != null && now >= b.startMin && now < b.endMin}
                  />
                ))}
                {showDraft && (
                  <div
                    className="pointer-events-none absolute right-1 left-1 rounded-[10px] border-[1.5px] border-dashed border-accent bg-accent-soft/70"
                    style={{ top: y(draft.start) + 1, height: (draft.end - draft.start) * pxPerMin - 2 }}
                  >
                    <span className="tnum block px-2 pt-1 text-[11.5px] font-semibold text-accent">{formatMin(draft.start)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* now line */}
        {todayCol >= 0 && now != null && now >= range.start && now <= range.end && (
          <div className="pointer-events-none absolute right-0 left-0 z-20" style={{ top: y(now) }}>
            <span
              className="tnum absolute -translate-y-1/2 rounded-full bg-accent px-1.5 py-[1px] text-[10px] font-semibold text-accent-ink"
              style={{ right: `calc(100% - ${gutter - 2}px)` }}
            >
              {formatMin(now, true).replace(/(am|pm)$/, "")}
            </span>
            <div
              className="absolute h-[1.5px] -translate-y-1/2 bg-accent"
              style={
                columns.length > 1
                  ? {
                      left: `calc(${gutter}px + (100% - ${gutter}px) * ${todayCol / columns.length})`,
                      width: `calc((100% - ${gutter}px) / ${columns.length})`,
                    }
                  : { left: gutter, right: 0 }
              }
            />
            <span
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
              style={{
                left: columns.length > 1 ? `calc(${gutter}px + (100% - ${gutter}px) * ${todayCol / columns.length})` : gutter,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BlockCard({
  block: b,
  style,
  compact,
  live,
  onOpen,
}: {
  block: PlanBlock;
  style: CSSProperties;
  compact: boolean;
  live: boolean;
  onOpen: () => void;
}) {
  const h = typeof style.height === "number" ? style.height : 40;
  const done = !!b.doneAt;
  const skipped = !!b.skippedAt;
  const Icon = KIND_ICON[b.kind];
  const oneLine = h < (compact ? 30 : 36);
  const time = `${formatMin(b.startMin, true)} – ${formatMin(b.endMin, true)}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "tap absolute z-10 overflow-hidden rounded-[10px] text-left",
        "border border-line bg-[var(--fill)] shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        done && "opacity-55",
        skipped && "opacity-45",
        live && "ring-[1.5px] ring-[var(--bar)]",
      )}
      style={{
        ...style,
        ...blockVars(b.color),
        ...(skipped
          ? {
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--ink-3) 10%, transparent) 6px 7px)",
            }
          : null),
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--bar)]" />
      <span
        className={cn(
          "flex h-full min-w-0 flex-col pr-1.5",
          compact ? "pl-[7px]" : "pl-[10px]",
          oneLine ? "justify-center" : compact ? "pt-1" : "pt-[5px]",
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-1", oneLine && "gap-1.5")}>
          {done && <Check className="size-3.5 shrink-0 text-[var(--bar-ink)]" strokeWidth={3} />}
          {!done && !b.color && !compact && <Icon className="size-3 shrink-0 text-ink-3" strokeWidth={2.2} />}
          <span
            className={cn(
              "truncate font-semibold tracking-tight text-ink",
              compact ? "text-[11px] leading-tight" : "text-[13px] leading-snug",
              skipped && "line-through decoration-ink-3",
            )}
          >
            {b.title}
          </span>
          {oneLine && !compact && <span className="tnum shrink-0 text-[11px] text-ink-3">{formatMin(b.startMin, true)}</span>}
        </span>
        {!oneLine && (
          <span className={cn("tnum truncate text-ink-2", compact ? "text-[10px]" : "text-[11.5px]")}>
            {compact ? formatMin(b.startMin, true) : time}
          </span>
        )}
        {!compact && h >= 62 && b.goalTitle && (
          <span className="mt-auto mb-1.5 truncate text-[11px] font-medium text-[var(--bar-ink)]">{b.goalTitle}</span>
        )}
      </span>
    </button>
  );
}

function GhostBlock({ ghost, top, height, compact }: { ghost: Ghost; top: number; height: number; compact: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add ${ghost.name} to calendar`}
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) start(() => addScheduledWorkout(ghost.date));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !pending) start(() => addScheduledWorkout(ghost.date));
      }}
      className="tap absolute right-[3px] left-[3px] z-[5] overflow-hidden rounded-[10px] border-[1.5px] border-dashed"
      style={{
        top: top + 1,
        height: Math.max(24, height - 2),
        borderColor: `color-mix(in oklab, ${colorVar(ghost.color)} 55%, transparent)`,
        background: `color-mix(in oklab, ${softVar(ghost.color)} 45%, transparent)`,
      }}
    >
      <div className={cn("flex h-full items-start justify-between gap-2", compact ? "p-1" : "py-1.5 pr-1.5 pl-2.5")}>
        <div className="min-w-0">
          <div
            className={cn("flex items-center gap-1.5 font-semibold", compact ? "text-[11px]" : "text-[13px]")}
            style={{ color: colorVar(ghost.color) }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Dumbbell className="size-3.5 shrink-0" />}
            <span className="truncate">{ghost.name}</span>
          </div>
          {!compact && (
            <div className="tnum mt-0.5 truncate text-[11.5px] text-ink-3">
              {ghost.startMin != null && formatMin(ghost.startMin, true)} · {formatDuration(ghost.durationMin)} · Tap to add
            </div>
          )}
        </div>
        {!compact && (
          <Link
            href="/fitness"
            onClick={(e) => e.stopPropagation()}
            className="tap inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-white"
            style={{ background: colorVar(ghost.color) }}
          >
            <Play className="size-3 fill-current" /> Start
          </Link>
        )}
      </div>
    </div>
  );
}

export { GhostBlock };
