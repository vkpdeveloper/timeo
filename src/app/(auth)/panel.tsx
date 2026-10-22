"use client";

import { Countdown, useNow } from "@/components/ui/live";
import { cn } from "@/lib/cn";

const MIN = 60_000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

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

/**
 * The block you would be on right now: an hour that started on the last
 * quarter hour, at least ten minutes ago, counting down to its end.
 */
export function NowPill() {
  const now = useNow();
  const midnight = now ? new Date(now).setHours(0, 0, 0, 0) : 0;
  const startMin = Math.floor(((now - midnight) / MIN - 10) / 15) * 15;
  const end = midnight + (startMin + 60) * MIN;

  return (
    <div
      className={cn(
        "flex h-[52px] shrink-0 items-center gap-3 rounded-full bg-[var(--ember-ink)] pr-5 pl-2 text-[#1a1714] transition-opacity duration-500",
        now ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="grid size-9 place-items-center rounded-full bg-[#1a1714] text-[9.5px] font-bold tracking-[0.04em] text-[var(--ember-ink)]">
        NOW
      </span>
      <span className="text-[15.5px] font-medium tracking-[-0.01em]">Write chapter three</span>
      <span className="mono ml-1.5 inline-flex items-baseline gap-[0.6ch] text-[13.5px] text-[#6b645c]">
        <Countdown to={now ? end : undefined} />
        left
      </span>
    </div>
  );
}
