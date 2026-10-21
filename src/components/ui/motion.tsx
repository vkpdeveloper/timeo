"use client";

import { animate, motion, type Transition } from "motion/react";
import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/dates";

/*
 * Motion for every screen. Mount animations are CSS (globals.css: .rise,
 * .stagger, .page-enter) so they run before hydration and cost nothing; JS
 * motion is only used where it has to measure or count.
 */

/** Spring presets for motion/react. 150–350 ms feel. */
export const springs = {
  /** Small things: pills, checks, chips. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** Default for layout moves and reorders. */
  smooth: { type: "spring", stiffness: 380, damping: 34, mass: 0.9 },
  /** Sheets and large surfaces. */
  sheet: { type: "spring", stiffness: 340, damping: 34, mass: 0.9 },
  /** A soft settle, for hero elements. */
  gentle: { type: "spring", stiffness: 220, damping: 28 },
} satisfies Record<string, Transition>;

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduce(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Like motion's useReducedMotion, but hydration safe: false on the server and
 * during hydration, so SSR'd `initial` styles match the client. motion's own
 * hook reads the media query on the first client render, which leaves rows
 * stuck at opacity 0 for people who prefer reduced motion.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE_QUERY).matches, () => false);
}

/** Props for a list item that animates in, out and when reordered. Spread onto a motion element. */
export const listItem = {
  layout: true,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
  transition: springs.smooth,
} as const;

type DelayStyle = CSSProperties & { "--delay"?: string; "--i"?: number; "--stagger"?: string; "--stagger-base"?: string };

/**
 * Fade + 6px rise. Plays on mount by default (pure CSS), or when scrolled
 * into view with `inView`.
 */
export function Reveal({
  children,
  delay = 0,
  inView = false,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  /** ms */
  delay?: number;
  /** Wait until the element scrolls into view. */
  inView?: boolean;
  as?: "div" | "section" | "li" | "span";
  className?: string;
}) {
  if (inView) return <InViewReveal delay={delay} className={className}>{children}</InViewReveal>;
  const style: DelayStyle = delay ? { "--delay": `${delay}ms` } : {};
  return (
    <Tag className={cn("rise", className)} style={style}>
      {children}
    </Tag>
  );
}

function InViewReveal({ children, delay, className }: { children: ReactNode; delay: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ ...springs.gentle, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

/** Direct children rise one after another (35 ms apart by default). */
export function Stagger({
  children,
  step = 35,
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  /** ms between children */
  step?: number;
  /** ms before the first child */
  delay?: number;
  as?: "div" | "ul" | "ol" | "section";
  className?: string;
}) {
  const style: DelayStyle = {};
  if (step !== 35) style["--stagger"] = `${step}ms`;
  if (delay) style["--stagger-base"] = `${delay}ms`;
  return (
    <Tag className={cn("stagger", className)} style={style}>
      {children}
    </Tag>
  );
}

/**
 * An item that staggers by an explicit index, for when the items are not
 * direct children of one container (e.g. rows inside separate cards).
 */
export function StaggerItem({
  index,
  step = 35,
  children,
  as: Tag = "div",
  className,
}: {
  index: number;
  step?: number;
  children: ReactNode;
  as?: "div" | "li" | "section";
  className?: string;
}) {
  const style: DelayStyle = { "--delay": `${Math.min(index, 11) * step}ms` };
  return (
    <Tag className={cn("rise", className)} style={style}>
      {children}
    </Tag>
  );
}

/** Wraps a page (template.tsx) or a swapped view (give it a `key`) in a quick enter animation. */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-enter", className)}>{children}</div>;
}

type CountFormat = "int" | "decimal" | "duration" | "percent";

const formatters: Record<CountFormat, (v: number) => string> = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  decimal: (v) => (Math.round(v * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  /** minutes -> "3h 40m" */
  duration: (v) => formatDuration(v),
  /** 0..1 -> "42%" */
  percent: (v) => `${Math.round(v * 100)}%`,
};

/**
 * Animates a number up to `value` on mount and whenever it changes.
 * Server-safe: renders the final value first, so no-JS and snapshots are right.
 */
export function CountUp({
  value,
  format = "int",
  from = 0,
  duration = 0.7,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  format?: CountFormat;
  /** Start of the first animation. */
  from?: number;
  /** seconds */
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const fmt = formatters[format];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current ?? from;
    prev.current = value;
    const show = (v: number) => {
      el.textContent = prefix + fmt(v) + suffix;
    };
    if (reduce || start === value) return show(value);
    let stop = () => {};
    const run = () => {
      const controls = animate(start, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: show });
      stop = () => controls.stop();
    };
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) {
      run();
      return () => stop();
    }
    // Off screen: count when it scrolls in.
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [value, reduce, from, duration, prefix, suffix, fmt]);

  return (
    <span ref={ref} className={cn("tnum-live", className)}>
      {prefix + fmt(value) + suffix}
    </span>
  );
}
