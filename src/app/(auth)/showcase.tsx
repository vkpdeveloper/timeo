"use client";

import { Timi } from "@/components/ai/timi";
import { Countdown, LinearProgress, useNow } from "@/components/ui/live";
import { DayLine, type DaySegment } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";

const MIN = 60_000;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * A live moment from Now, drawn with the app's own primitives: the block you
 * are on, its countdown, and the day around it. Times follow this device's clock.
 */
export function AuthShowcase() {
  const now = useNow();

  // A one-hour block that started on the last quarter hour, at least ten minutes ago.
  const midnight = now ? new Date(now).setHours(0, 0, 0, 0) : 0;
  const nowMin = now ? (now - midnight) / MIN : 0;
  const startMin = Math.floor((nowMin - 10) / 15) * 15;
  const endMin = startMin + 60;
  const at = (m: number) => midnight + m * MIN;

  const dayStart = startMin - 300;
  const dayEnd = startMin + 420;
  const segments: DaySegment[] = [
    {
      start: startMin - 270,
      end: startMin - 180,
      color: colorVar("sky"),
      state: "done",
      label: "Read",
    },
    {
      start: startMin - 120,
      end: startMin - 60,
      color: colorVar("sand"),
      state: "done",
      label: "Run",
    },
    {
      start: startMin,
      end: endMin,
      color: "var(--accent)",
      state: "now",
      label: "Write chapter three",
    },
    {
      start: startMin + 150,
      end: startMin + 210,
      color: colorVar("sky"),
      state: "upcoming",
      label: "Spanish",
    },
  ];

  return (
    <div className="flex w-full flex-col p-12 xl:p-16">
      <div className="flex flex-1 items-center justify-center pb-10">
        <div className={cn("w-full max-w-[480px] transition-opacity duration-500", now ? "opacity-100" : "opacity-0")}>
          <div className="mb-5 text-[13.5px] font-medium text-ink-3">Now</div>

          <div className="flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            <span className="size-2.5 shrink-0 rounded-full bg-accent" />
            Write chapter three
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <Countdown to={now ? at(endMin) : undefined} className="text-[80px] font-medium tracking-[-0.05em] text-ink xl:text-[96px]" />
            <span className="text-[17px] font-medium text-ink-3">left</span>
          </div>

          {now > 0 && (
            <LinearProgress
              className="mt-6"
              startAt={at(startMin)}
              endAt={at(endMin)}
              start={clock(at(startMin))}
              end={clock(at(endMin))}
              color="var(--accent)"
              height={4}
            />
          )}

          <div className="mt-12 mb-3 text-[13.5px] font-medium text-ink-3">Today</div>
          {now > 0 && (
            <DayLine
              segments={segments}
              dayStart={dayStart}
              dayEnd={dayEnd}
              nowMin={nowMin}
              labels={{ start: clock(at(dayStart)), end: clock(at(dayEnd)) }}
              height={12}
            />
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[480px] items-end justify-between gap-8">
        <div className="max-w-[340px]">
          <p className="text-[24px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-ink">One thing at a time.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-pretty text-ink-2">
            Timeo turns your goals into time on the calendar, then shows you what to do right now.
          </p>
        </div>
        <Timi size={72} interactive className="-mb-1" />
      </div>
    </div>
  );
}
