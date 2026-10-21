"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Things that tick. One shared clock (aligned to the second) drives every
 * Countdown and live LinearProgress on screen.
 */

let now = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
  timer = setTimeout(tick, 1000 - (now % 1000) + 5);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setTimeout(tick, 1000 - (now % 1000) + 5);
    queueMicrotask(cb);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/**
 * Unix ms, updated every second while mounted. Returns `initial` while server
 * rendering and hydrating (pass the server's `Date.now()` to avoid a flash), or 0.
 */
export function useNow(initial = 0): number {
  return useSyncExternalStore(subscribe, snapshot, () => initial);
}

function snapshot() {
  // Not ticking yet: read the clock, rounded so repeated reads in one render agree
  if (!timer) now = Math.floor(Date.now() / 1000) * 1000;
  return now;
}

/** seconds -> "17:42" or "1:05:09" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Each changed digit rolls in from above. Fixed width (Geist Mono), so nothing shifts. */
function Rolling({ text }: { text: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{text}</>;
  return (
    <>
      {text.split("").map((ch, i) => {
        const pos = text.length - i; // keyed from the right so digits keep their slot
        if (ch < "0" || ch > "9") return <span key={`s${pos}`}>{ch}</span>;
        return (
          <span key={`d${pos}`} className="relative inline-block overflow-hidden align-bottom">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="inline-block"
                initial={{ y: "-100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 44, mass: 0.5 }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </>
  );
}

/**
 * A ticking clock in Geist Mono with tabular figures. Counts down to `to`
 * (unix ms), or up from `from` when `to` is not set. Size it with a text class.
 *
 *   <Countdown to={block.endAt} now={serverNow} className="text-[56px]" />  ->  "17:42"
 */
export function Countdown({
  to,
  from,
  now: initial,
  roll = true,
  onDone,
  className,
}: {
  /** Unix ms to count down to. */
  to?: number;
  /** Unix ms to count up from (used when `to` is not set). */
  from?: number;
  /** Server's Date.now(), so the first paint is already right. */
  now?: number;
  /** Digits roll as they change. */
  roll?: boolean;
  /** Called once when a countdown reaches zero. */
  onDone?: () => void;
  className?: string;
}) {
  const t = useNow(initial ?? 0);
  const sec = !t ? null : to != null ? (to - t) / 1000 : from != null ? (t - from) / 1000 : 0;
  const text = sec == null ? "--:--" : formatClock(to != null ? Math.ceil(sec) : sec);
  const fired = useRef(false);
  const done = to != null && sec != null && sec <= 0;
  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onDone?.();
    }
    if (!done) fired.current = false;
  }, [done, onDone]);

  return (
    <span className={cn("mono inline-flex leading-none", className)} role="timer" aria-live="off">
      {roll && sec != null ? <Rolling text={text} /> : text}
    </span>
  );
}

/**
 * A thin bar with start / end labels under it (Geist Mono). Static with `value`
 * (0..1), or live with `startAt` / `endAt` (unix ms), filling every second.
 *
 *   <LinearProgress startAt={start} endAt={end} start="21:44" end="22:29" />
 */
export function LinearProgress({
  value,
  startAt,
  endAt,
  now: initial,
  start,
  end,
  color = "var(--tint)",
  height = 4,
  className,
}: {
  value?: number;
  startAt?: number;
  endAt?: number;
  now?: number;
  /** Label under the left end, e.g. "21:44". */
  start?: ReactNode;
  /** Label under the right end, e.g. "22:29". */
  end?: ReactNode;
  color?: string;
  /** px */
  height?: number;
  className?: string;
}) {
  const live = startAt != null && endAt != null;
  const t = useNow(live ? (initial ?? 0) : 0);
  const v = live ? (t ? (t - startAt) / Math.max(1, endAt - startAt) : 0) : (value ?? 0);
  const pct = Math.max(0, Math.min(1, v)) * 100;
  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden rounded-full bg-sunken" style={{ height }}>
        <div
          className="meter-grow absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: color, transition: "width 900ms linear" }}
        />
      </div>
      {(start != null || end != null) && (
        <div className="mono mt-2 flex items-center justify-between text-[12px] text-ink-3">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      )}
    </div>
  );
}
