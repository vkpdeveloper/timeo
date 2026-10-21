"use client";

import { useEffect, useState } from "react";
import { trainedMs, WORKOUT_LIMIT_MIN, type WorkoutClock } from "@/lib/fitness-math";

const fmt = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** Live time trained. Ticks while running; stops when paused or at the workout limit. */
export function useWorkoutClock(clock: WorkoutClock, live = true) {
  const [now, setNow] = useState(() => Date.now());
  const sec = Math.floor(trainedMs(clock, now) / 1000);
  const paused = clock.pausedAt != null;
  const capped = sec >= WORKOUT_LIMIT_MIN * 60;
  const ticking = live && !paused && !capped;
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // catch up right away after a resume
    const i = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(i);
    };
  }, [ticking]);
  return { sec, label: fmt(sec), paused, capped };
}

/** "23:10" that keeps counting, for screens outside the logger. */
export function WorkoutClockText({ clock, className }: { clock: WorkoutClock; className?: string }) {
  const { label, paused, capped } = useWorkoutClock(clock);
  return (
    <span suppressHydrationWarning className={className}>
      {label}
      {paused ? " · Paused" : capped ? " · Time's up" : ""}
    </span>
  );
}
