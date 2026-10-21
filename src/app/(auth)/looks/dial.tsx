"use client";

import { Timi } from "@/components/ai/timi";
import { Countdown, useNow } from "@/components/ui/live";
import { colorVar } from "@/lib/colors";

const MIN = 60_000;
const SIZE = 560;
const C = SIZE / 2;
const pad = (n: number) => String(n).padStart(2, "0");

/** Point on the dial for a minute of the day, 0 at the top, clockwise. */
function point(min: number, r: number) {
  const a = (min / 1440) * Math.PI * 2 - Math.PI / 2;
  // Rounded so server and browser print the same attribute values.
  return [Math.round((C + r * Math.cos(a)) * 100) / 100, Math.round((C + r * Math.sin(a)) * 100) / 100] as const;
}

function arc(start: number, end: number, r: number) {
  const [x1, y1] = point(start, r);
  const [x2, y2] = point(end, r);
  const large = end - start > 720 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * The day as a turntable. The dial turns with the real clock so "now" always
 * sits under the needle at the top; your blocks come round to meet it.
 */
export function DialLook() {
  const now = useNow();
  const midnight = now ? new Date(now).setHours(0, 0, 0, 0) : 0;
  const nowMin = now ? (now - midnight) / MIN : 0;
  const startMin = Math.floor((nowMin - 12) / 15) * 15;
  const endMin = startMin + 60;

  const blocks = [
    { start: startMin - 300, end: startMin - 210, color: colorVar("sky"), done: true },
    { start: startMin - 150, end: startMin - 90, color: colorVar("sand"), done: true },
    { start: startMin, end: endMin, color: "var(--accent)", done: false, now: true },
    { start: startMin + 120, end: startMin + 210, color: colorVar("teal"), done: false },
    { start: startMin + 270, end: startMin + 315, color: colorVar("sky"), done: false },
  ];
  const turn = -(nowMin / 1440) * 360;

  return (
    <div className="relative flex w-full flex-col items-center justify-center p-12">
      <div className="relative" style={{ width: SIZE, height: SIZE, opacity: now ? 1 : 0, transition: "opacity 600ms" }}>
        {/* needle */}
        <div className="absolute top-[-14px] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center">
          <span className="font-mono text-[12px] text-ink-3 tabular-nums">
            {now ? `${pad(new Date(now).getHours())}:${pad(new Date(now).getMinutes())}` : ""}
          </span>
          <span className="mt-1 h-10 w-[2px] rounded-full bg-accent" />
        </div>

        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 size-full"
          style={{ transform: `rotate(${turn}deg)`, transition: "transform 1s linear" }}
          aria-hidden
        >
          <circle cx={C} cy={C} r={C - 40} fill="none" stroke="var(--line-strong)" strokeWidth={1} />
          {Array.from({ length: 96 }, (_, i) => {
            const major = i % 12 === 0;
            const [x1, y1] = point(i * 15, C - 40);
            const [x2, y2] = point(i * 15, C - (major ? 56 : 46));
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={major ? "var(--ink-3)" : "var(--line-strong)"}
                strokeWidth={major ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = point(h * 60, C - 76);
            return (
              <text
                key={h}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-ink-3 font-mono text-[13px]"
                transform={`rotate(${-turn} ${x} ${y})`}
              >
                {pad(h)}
              </text>
            );
          })}
          {blocks.map((b, i) => (
            <path
              key={i}
              d={arc(b.start, b.end, C - 112)}
              fill="none"
              stroke={b.color}
              strokeWidth={b.now ? 30 : 22}
              strokeLinecap="round"
              opacity={b.done ? 0.35 : 1}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[13.5px] font-medium text-ink-3">Now</div>
          <div className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">Write chapter three</div>
          <Countdown to={now ? midnight + endMin * MIN : undefined} className="mt-2 text-[64px] font-medium tracking-[-0.05em] text-ink" />
          <div className="text-[14px] text-ink-3">left in this block</div>
        </div>
      </div>

      <div className="mt-12 flex w-full max-w-[560px] items-end justify-between gap-8">
        <div>
          <p className="text-[24px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">Your day comes round.</p>
          <p className="mt-2 max-w-[340px] text-[15px] leading-relaxed text-ink-2">
            The dial turns with the clock. Whatever sits under the needle is the one thing to do.
          </p>
        </div>
        <Timi size={64} interactive />
      </div>
    </div>
  );
}
