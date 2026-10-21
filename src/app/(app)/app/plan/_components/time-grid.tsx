"use client";

import { Check, Dumbbell, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition, type CSSProperties } from "react";
import { moveBlock } from "@/actions/blocks";
import { cn } from "@/lib/cn";
import { layoutColumns } from "@/lib/calendar-layout";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration, nowMinIn, toTimeInput } from "@/lib/dates";
import { addScheduledWorkout, resizeBlock } from "../actions";
import { blockVars, KIND_ICON } from "./block-style";
import { usePlan } from "./plan-provider";
import type { Ghost, PlanBlock } from "./types";

const SNAP = 15;
/** Hold this long on touch before a block lifts (a shorter touch scrolls). */
const HOLD_MS = 320;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const hhmm = (m: number) => toTimeInput(m % (24 * 60));

/** Minutes since midnight in the user's timezone, updated every minute. Null before mount. */
export function useNowMin(timezone: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowMinIn(timezone));
    tick();
    let interval: ReturnType<typeof setInterval> | undefined;
    // align to the start of the next minute, then tick every minute
    const timeout = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [timezone]);
  return now;
}

export type GridColumn = {
  date: string;
  blocks: PlanBlock[];
  ghost: Ghost | null;
};

type Pos = { date: string; startMin: number; endMin: number };
type Drag = { id: string; mode: "move" | "resize"; pos: Pos };

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
  const colsRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [, startTransition] = useTransition();
  // where a dropped block sits until the server's copy arrives
  const [moved, setMoved] = useOptimistic<Record<string, Pos>, { id: string; pos: Pos }>({}, (s, m) => ({
    ...s,
    [m.id]: m.pos,
  }));

  const pxPerMin = hourPx / 60;
  const height = (range.end - range.start) * pxPerMin;
  const y = (min: number) => (min - range.start) * pxPerMin;
  const hours: number[] = [];
  for (let h = range.start; h <= range.end; h += 60) hours.push(h);
  const todayCol = columns.findIndex((c) => c.date === today);

  const blocks = columns.flatMap((c) => c.blocks);
  const placed = blocks.map((b) => {
    const p = drag?.id === b.id ? drag.pos : moved[b.id];
    return p ? { ...b, ...p } : b;
  });

  // Bring "now" (or the first block) into view when the day opens.
  useEffect(() => {
    if (!autoScroll || scrolled.current || !ref.current) return;
    const col = columns[0];
    const isToday = col?.date === today;
    if (isToday && now == null) return;
    scrolled.current = true;
    const first = col?.blocks.find((b) => !b.skippedAt)?.startMin;
    const target = isToday ? now! : (first ?? null);
    if (target == null) return;
    const top = ref.current.getBoundingClientRect().top + window.scrollY + y(target);
    if (top - window.scrollY > window.innerHeight * 0.6) {
      window.scrollTo({
        top: Math.max(0, top - window.innerHeight * 0.32),
        behavior: "instant",
      });
    }
  });

  const onTap = (date: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = range.start + (e.clientY - rect.top) / pxPerMin;
    const start = clamp(Math.floor(min / SNAP) * SNAP, range.start, range.end - SNAP);
    openNew({ date, start, end: Math.min(24 * 60, start + 60) });
  };

  /**
   * Move (press and drag the block; on touch, hold first) or resize (drag the
   * bottom edge). The block follows in 15-minute steps, across days in the week
   * grid, and stays where it was dropped while the server saves it.
   */
  const beginDrag = (e: React.PointerEvent, b: PlanBlock, mode: Drag["mode"]) => {
    if (e.button !== 0 || !colsRef.current) return;
    const pointerId = e.pointerId;
    const touch = e.pointerType !== "mouse";
    const x0 = e.clientX;
    const y0 = e.clientY;
    const rect0 = colsRef.current.getBoundingClientRect();
    const grab = range.start + (y0 - rect0.top) / pxPerMin - b.startMin;
    const dur = b.endMin - b.startMin;
    let last: Pos = { date: b.date, startMin: b.startMin, endMin: b.endMin };
    let active = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const at = (cx: number, cy: number): Pos => {
      const r = colsRef.current!.getBoundingClientRect();
      const min = range.start + (cy - r.top) / pxPerMin;
      if (mode === "resize") {
        return { date: b.date, startMin: b.startMin, endMin: clamp(snap(min), b.startMin + SNAP, range.end) };
      }
      const ci = clamp(Math.floor(((cx - r.left) / r.width) * columns.length), 0, columns.length - 1);
      const start = clamp(snap(min - grab), range.start, Math.max(range.start, range.end - dur));
      return { date: columns[ci].date, startMin: start, endMin: start + dur };
    };
    const activate = () => {
      active = true;
      suppressClick.current = true;
      if (touch) navigator.vibrate?.(8);
      setDrag({ id: b.id, mode, pos: last });
    };
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        // on touch a move before the hold is a scroll
        if (touch && mode === "move") {
          if (dist > 8) cleanup();
          return;
        }
        if (dist < 4) return;
        activate();
      }
      const p = at(ev.clientX, ev.clientY);
      if (p.date !== last.date || p.startMin !== last.startMin || p.endMin !== last.endMin) {
        last = p;
        setDrag({ id: b.id, mode, pos: p });
      }
      // keep the block in view at the edges: under the sticky week bar, above the tab bar
      const top = document.querySelector("[data-week-sticky]")?.getBoundingClientRect().bottom ?? 0;
      const bottom = window.innerHeight - (window.matchMedia("(min-width: 1024px)").matches ? 0 : 80);
      if (ev.clientY < top + 24) window.scrollBy(0, -8);
      else if (ev.clientY > bottom - 24) window.scrollBy(0, 8);
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (active) ev.preventDefault();
    };
    const onCancel = () => {
      cleanup();
      setDrag(null);
      setTimeout(() => (suppressClick.current = false), 0);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (!active) return;
      // the click that follows this pointerup must not open the block
      setTimeout(() => (suppressClick.current = false), 0);
      const pos = last;
      setDrag(null);
      if (pos.date === b.date && pos.startMin === b.startMin && pos.endMin === b.endMin) return;
      startTransition(async () => {
        setMoved({ id: b.id, pos });
        try {
          if (mode === "resize") await resizeBlock(b.id, pos.endMin);
          else await moveBlock(b.id, pos.date, pos.startMin);
        } catch {
          // the block snaps back when the optimistic copy is dropped
        }
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    if (touch && mode === "move") timer = setTimeout(activate, HOLD_MS);
    else if (mode === "resize") activate();
  };

  const gutter = compact ? 40 : 46;

  return (
    <div ref={ref} className="relative select-none" style={{ height: height + 16, paddingTop: 8 }}>
      <div className="relative" style={{ height }}>
        {/* hour lines and labels */}
        {hours.map((h) => (
          <div key={h} className="pointer-events-none absolute right-0 left-0" style={{ top: y(h) }}>
            <div className="absolute border-t border-line" style={{ left: gutter, right: 0 }} />
            <span
              className="mono absolute -translate-y-1/2 pr-2 text-right text-[10.5px] text-ink-3"
              style={{ width: gutter }}
            >
              {hhmm(h)}
            </span>
          </div>
        ))}

        <div ref={colsRef} className="absolute inset-y-0 right-0 flex" style={{ left: gutter }}>
          {columns.map((col, ci) => {
            const list = layoutColumns(placed.filter((b) => b.date === col.date));
            const showDraft = draft && draft.date === col.date;
            return (
              <div
                key={col.date}
                className={cn(
                  "relative min-w-0 flex-1 cursor-pointer",
                  columns.length > 1 && "border-l border-line",
                  columns.length > 1 && ci === todayCol && "bg-accent-soft/50",
                )}
                onClick={(e) => onTap(col.date, e)}
              >
                {col.ghost && col.ghost.startMin != null && (
                  <GhostBlock
                    ghost={col.ghost}
                    top={y(col.ghost.startMin)}
                    height={col.ghost.durationMin * pxPerMin}
                    compact={compact}
                  />
                )}
                {list.map(({ item: b, col: c, cols }, i) => (
                  <BlockCard
                    key={b.id}
                    block={b}
                    index={i}
                    compact={compact}
                    dragging={drag?.id === b.id ? drag.mode : null}
                    onPointerDown={(e, mode) => beginDrag(e, b, mode)}
                    onOpen={() => {
                      if (suppressClick.current) return;
                      // open the server's copy, not the preview
                      openBlock(blocks.find((x) => x.id === b.id) ?? b);
                    }}
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
                    className="pointer-events-none absolute right-1 left-1 rounded-[10px] border-[1.5px] border-dashed border-accent bg-accent-soft"
                    style={{
                      top: y(draft.start) + 1,
                      height: (draft.end - draft.start) * pxPerMin - 2,
                    }}
                  >
                    <span className="mono block px-2 pt-1 text-[11px] font-medium text-accent">{hhmm(draft.start)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* now: a thin accent line with the time in the gutter */}
        {todayCol >= 0 && now != null && now >= range.start && now <= range.end && (
          <div className="pointer-events-none absolute right-0 left-0 z-20" style={{ top: y(now) }}>
            <span
              className="mono absolute -translate-y-1/2 bg-bg pr-1.5 text-right text-[10.5px] font-medium text-accent"
              style={{ left: 0, width: gutter }}
            >
              {hhmm(now)}
            </span>
            <div
              className="absolute h-px -translate-y-1/2 bg-accent"
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
              className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
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
  index,
  style,
  compact,
  live,
  dragging,
  onPointerDown,
  onOpen,
}: {
  block: PlanBlock;
  index: number;
  style: CSSProperties;
  compact: boolean;
  live: boolean;
  dragging: "move" | "resize" | null;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onOpen: () => void;
}) {
  const h = typeof style.height === "number" ? style.height : 40;
  const done = !!b.doneAt;
  const skipped = !!b.skippedAt;
  const Icon = KIND_ICON[b.kind];
  const oneLine = h < (compact ? 30 : 38);
  const time = `${hhmm(b.startMin)}–${hhmm(b.endMin)}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${b.title}, ${time}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "rise group absolute z-10 overflow-hidden rounded-[10px] text-left [-webkit-touch-callout:none]",
        "ease-out",
        dragging
          ? "z-30 cursor-grabbing opacity-95 shadow-float transition-[top,height,left,width] duration-[90ms]"
          : "cursor-pointer transition-[top,height,left,width,opacity] duration-200 pointer-fine:cursor-grab",
        skipped ? "border border-dashed border-line-strong bg-transparent" : "bg-[var(--fill)]",
        done && !dragging && "opacity-55",
      )}
      style={{
        ...style,
        ...blockVars(b.color),
        ["--delay" as string]: `${Math.min(index, 8) * 25}ms`,
        boxShadow: live && !dragging ? "inset 0 0 0 1.5px var(--bar)" : undefined,
      }}
    >
      {!skipped && <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--bar)]" />}
      <span
        className={cn(
          "flex h-full min-w-0 flex-col pr-1.5",
          compact ? "pl-[8px]" : "pl-[11px]",
          oneLine ? "justify-center" : compact ? "pt-1" : "pt-[5px]",
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-1", oneLine && "gap-1.5")}>
          {done && <Check className="size-3.5 shrink-0 text-[var(--bar-ink)]" strokeWidth={2.6} />}
          {!done && !b.color && !compact && <Icon className="size-3 shrink-0 text-ink-3" strokeWidth={2.2} />}
          <span
            className={cn(
              "truncate font-semibold tracking-tight",
              compact ? "text-[11px] leading-tight" : "text-[13px] leading-snug",
              skipped ? "text-ink-3 line-through decoration-ink-3" : "text-ink",
            )}
          >
            {b.title}
          </span>
          {oneLine && !compact && <span className="mono shrink-0 text-[11px] text-ink-3">{hhmm(b.startMin)}</span>}
        </span>
        {!oneLine && (
          <span className={cn("mono truncate text-ink-2", compact ? "text-[10px]" : "text-[11px]")}>
            {compact && !dragging ? hhmm(b.startMin) : time}
          </span>
        )}
        {!compact && h >= 62 && b.goalTitle && (
          <span className="mt-auto mb-1.5 truncate text-[11.5px] font-medium text-[var(--bar-ink)]">{b.goalTitle}</span>
        )}
      </span>
      {/* resize: drag the bottom edge */}
      {!skipped && h >= 30 && (
        <span
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, "resize");
          }}
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-[3px]"
        >
          <span
            className={cn(
              "h-[3px] w-6 rounded-full bg-[var(--bar)] opacity-0 transition-opacity group-hover:opacity-50",
              dragging === "resize" && "opacity-70",
            )}
          />
        </span>
      )}
    </div>
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
      className="tap rise absolute right-[3px] left-[3px] z-[5] overflow-hidden rounded-[10px] border border-dashed"
      style={{
        top: top + 1,
        height: Math.max(24, height - 2),
        borderColor: colorVar(ghost.color),
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
              {ghost.startMin != null && <span className="mono">{hhmm(ghost.startMin)}</span>} · {formatDuration(ghost.durationMin)} · From
              your split, tap to add
            </div>
          )}
        </div>
        {!compact && (
          <Link
            href="/app/fitness"
            onClick={(e) => e.stopPropagation()}
            className="tap inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold"
            style={{ background: softVar(ghost.color), color: colorVar(ghost.color) }}
          >
            <Play className="size-3 fill-current" /> Start
          </Link>
        )}
      </div>
    </div>
  );
}
