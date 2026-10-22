"use client";

import { Countdown, useNow } from "@/components/ui/live";
import { DayLine, type DaySegment } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const MIN = 60_000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Start of the block on screen (unix ms), held until it ends so the countdown never jumps. */
let held = 0;

/**
 * The block you would be on right now: an hour that started on the last
 * quarter hour, at least ten minutes ago. Minutes are from that day's midnight.
 */
function nowBlock(now: number) {
  if (now && (now < held || now >= held + 60 * MIN)) {
    const midnight = new Date(now).setHours(0, 0, 0, 0);
    held = midnight + Math.floor(((now - midnight) / MIN - 10) / 15) * 15 * MIN;
  }
  const midnight = now ? new Date(held).setHours(0, 0, 0, 0) : 0;
  const startMin = (held - midnight) / MIN;
  return { nowMin: (now - midnight) / MIN, startMin, endMin: startMin + 60, at: (m: number) => midnight + m * MIN };
}

/** "Wed · 09:55" on this device's clock. */
export function PanelClock() {
  const now = useNow();
  const d = new Date(now);
  return (
    <span className={cn("transition-opacity duration-500", now ? "opacity-100" : "opacity-0")}>
      {DAYS[d.getDay()]} · {pad(d.getHours())}:{pad(d.getMinutes())}
    </span>
  );
}

/** The one thing: a white pill counting down to the end of the current block. */
export function NowPill() {
  const now = useNow();
  const { at, endMin } = nowBlock(now);

  return (
    <div
      className={cn(
        "flex h-[52px] shrink-0 items-center gap-3 rounded-full bg-white pr-5 pl-2 text-[#111318] transition-opacity duration-500",
        now ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="grid size-9 place-items-center rounded-full bg-[var(--panel)] text-[9.5px] font-bold tracking-[0.04em] text-white">
        NOW
      </span>
      <span className="text-[15.5px] font-medium tracking-[-0.01em]">Write chapter three</span>
      <span className="mono ml-1.5 inline-flex items-baseline gap-[0.6ch] text-[13.5px] text-[#575c66]">
        <Countdown to={now ? at(endMin) : undefined} />
        left
      </span>
    </div>
  );
}

/** The day around it, drawn with the app's own DayLine: two blocks done, this one filling, two to come. */
export function PanelDay() {
  const now = useNow();
  const { at, nowMin, startMin, endMin } = nowBlock(now);
  const done = "rgb(255 255 255 / 0.55)";
  const segments: DaySegment[] = [
    { start: startMin - 270, end: startMin - 180, color: done, state: "done", label: "Read" },
    { start: startMin - 120, end: startMin - 60, color: done, state: "done", label: "Run" },
    { start: startMin, end: endMin, color: "#fff", state: "now", label: "Write chapter three" },
    { start: startMin + 150, end: startMin + 210, color: "#fff", state: "upcoming", label: "Spanish" },
    { start: startMin + 300, end: startMin + 345, color: "#fff", state: "upcoming", label: "Reading" },
  ];
  // Twelve whole hours, five before this block, marked every three
  const dayStart = Math.floor(startMin / 60) * 60 - 300;
  const dayEnd = dayStart + 720;
  const marks = [180, 360, 540].map((m) => dayStart + m).filter((m) => m >= 0);

  return (
    <div className={cn("min-h-[42px] transition-opacity duration-500", now ? "opacity-100" : "opacity-0")}>
      {now > 0 && (
        <DayLine
          segments={segments}
          dayStart={dayStart}
          dayEnd={dayEnd}
          nowMin={nowMin}
          labels={{ start: clock(at(dayStart)), end: clock(at(dayEnd)) }}
          marks={marks}
          height={12}
        />
      )}
    </div>
  );
}
