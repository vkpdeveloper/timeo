"use client";

import { motion, MotionConfig, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";

export const ease = [0.22, 1, 0.36, 1] as const;
export const spring = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as const;

/** Transforms switch off for people who prefer reduced motion; fades stay. */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fade + rise when scrolled into view (once). */
export function Reveal({
  delay = 0,
  y = 18,
  className,
  children,
  ...rest
}: { delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Words rise one after another out of a clipped line. */
export function Words({
  text,
  className,
  accentFrom,
  delay = 0,
  stagger = 0.06,
  inView = false,
}: {
  text: string;
  className?: string;
  /** Words from this index on are set in accent italics */
  accentFrom?: number;
  delay?: number;
  stagger?: number;
  /** Animate on scroll into view instead of on mount */
  inView?: boolean;
}) {
  const words = text.split(" ");
  const target = { y: "0%", opacity: 1 };
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
            <motion.span
              className={cn("inline-block", accentFrom !== undefined && i >= accentFrom && "italic text-accent")}
              initial={{ y: "105%", opacity: 0 }}
              {...(inView ? { whileInView: target, viewport: { once: true } } : { animate: target })}
              transition={{ duration: 0.8, ease, delay: delay + i * stagger }}
            >
              {w}
            </motion.span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Twelve week ticks around slow-turning rings, with an accent arc drawn to week 3.
 * Purely decorative.
 */
export function SeasonRings({ className, weeks = 3 }: { className?: string; weeks?: number }) {
  const reduce = useReducedMotion();
  const r = 230;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      <motion.svg
        viewBox="0 0 600 600"
        className="size-full"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 240, ease: "linear", repeat: Infinity }}
      >
        <circle cx="300" cy="300" r="290" fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="300" cy="300" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
        <circle cx="300" cy="300" r="170" fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 8" />
        <circle cx="300" cy="300" r="110" fill="none" stroke="var(--line)" strokeWidth="1" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const on = i < weeks;
          return (
            <circle
              key={i}
              // rounded: server and browser trig can differ in the last digit
              cx={Math.round((300 + Math.cos(a) * r) * 100) / 100}
              cy={Math.round((300 + Math.sin(a) * r) * 100) / 100}
              r={on ? 5 : 3.5}
              fill={on ? "var(--accent)" : "var(--bg)"}
              stroke={on ? "none" : "var(--line-strong)"}
              strokeWidth="1"
            />
          );
        })}
        <motion.circle
          cx="300"
          cy="300"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          transform="rotate(-90 300 300)"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - (weeks - 1) / 12) }}
          viewport={{ once: true }}
          transition={{ duration: 2.2, ease, delay: 0.6 }}
        />
      </motion.svg>
    </div>
  );
}

/** Soft accent glow. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)" }}
    />
  );
}
