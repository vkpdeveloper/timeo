"use client";

import { useEffect, useRef, useState } from "react";
import { formatMonthDay } from "@/lib/dates";

type Point = { date: string; value: number };

/**
 * Single-series trend chart. `avg` (same length as points) draws a smoothed
 * line over faint daily dots, e.g. weight with a 7-day average.
 * Tap or hover shows the nearest value.
 */
export function LineChart({
  points,
  avg,
  height = 180,
  color = "var(--tint)",
  unit = "",
  format = (v: number) => String(Math.round(v * 10) / 10),
  label,
}: {
  points: Point[];
  avg?: number[];
  height?: number;
  color?: string;
  unit?: string;
  format?: (v: number) => string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = points.map((p) => p.value).concat(avg ?? []);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padY = (max - min) * 0.15;
  min -= padY;
  max += padY;

  const left = 36;
  const right = 10;
  const top = 26;
  const bottom = 22;
  const w = Math.max(0, width - left - right);
  const h = height - top - bottom;
  const x = (i: number) => left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * h;

  const main = avg ?? points.map((p) => p.value);
  const path = main.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => min + padY + f * (max - min - 2 * padY));

  const onMove = (clientX: number) => {
    const el = ref.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    const i = points.length === 1 ? 0 : Math.round(((px - left) / Math.max(1, w)) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };

  const a = active != null ? points[active] : null;
  const tipX = active != null ? Math.max(left + 40, Math.min(width - 50, x(active))) : 0;

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y select-none"
      style={{ height }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerDown={(e) => onMove(e.clientX)}
      onPointerLeave={() => setActive(null)}
      role="img"
      aria-label={label}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={left - 8} y={y(v) + 4} textAnchor="end" className="tnum fill-[var(--ink-3)] text-[10.5px]">
                {format(v)}
              </text>
            </g>
          ))}
          {points.length > 0 && (
            <>
              <text x={left} y={height - 4} className="fill-[var(--ink-3)] text-[10.5px]">
                {formatMonthDay(points[0].date)}
              </text>
              {points.length > 1 && (
                <text x={width - right} y={height - 4} textAnchor="end" className="fill-[var(--ink-3)] text-[10.5px]">
                  {formatMonthDay(points[points.length - 1].date)}
                </text>
              )}
            </>
          )}
          {avg &&
            points.map((p, i) => (
              <circle key={p.date} cx={x(i)} cy={y(p.value)} r={2.5} fill={color} opacity={0.28} />
            ))}
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {!avg &&
            points.length <= 40 &&
            points.map((p, i) => (
              <circle key={p.date} cx={x(i)} cy={y(p.value)} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          {a && active != null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={top - 4} y2={top + h} stroke="var(--line-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(main[active])} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {a && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-bg"
          style={{ left: tipX }}
        >
          <span className="tnum">
            {format(a.value)}
            {unit}
          </span>
          {avg && active != null && (
            <span className="tnum font-normal opacity-70"> · avg {format(avg[active])}</span>
          )}
          <span className="font-normal opacity-70"> · {formatMonthDay(a.date)}</span>
        </div>
      )}
    </div>
  );
}
