"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Small charts that draw themselves in on mount (pathLength springs).

const draw = { type: "spring", stiffness: 120, damping: 24, mass: 1 } as const;

/** A progress ring that sweeps in from zero. `value` is 0..1 (over 1 shows full). */
export function Ring({
  value,
  size = 48,
  stroke = 5,
  color = "var(--tint)",
  track = "var(--sunken)",
  delay = 0,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** seconds */
  delay?: number;
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: v }}
            transition={{ ...draw, delay }}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/** Tiny trend line that draws in; values are plotted evenly spaced. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "var(--c-sage)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={3.5}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={2}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 30, delay: reduce ? 0 : 0.7 }}
      />
    </svg>
  );
}

/** A thin bar that grows to `value` (0..1) on mount and when it changes. */
export function Bar({
  value,
  color = "var(--tint)",
  height = 6,
  delay = 0,
  className,
}: {
  value: number;
  color?: string;
  height?: number;
  /** seconds */
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-sunken", className)} style={{ height }}>
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ background: color }}
        initial={reduce ? false : { width: "0%" }}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: "spring", stiffness: 160, damping: 26, delay }}
      />
    </div>
  );
}
