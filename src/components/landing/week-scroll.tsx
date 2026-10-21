"use client";

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/components/ui/motion";

export type WeekMoment = { id: string; day: string; time: string; text: string; panel: ReactNode };

/** Scroll distance each moment holds the stage for. */
const PER_STEP = 70; // svh
/** Takes the edge off wheel ticks so the stage glides between moments. */
const smooth = { stiffness: 220, damping: 40, mass: 0.6 };
/** Share of a moment's scroll spent leaving, and again entering. */
const EDGE = 0.32;

/**
 * The week as a pinned stage. The section holds still while you scroll and the
 * moments replace one another in place: the outgoing copy and screen lift away,
 * the next ones rise in. Everything is driven by scroll position, so stopping
 * halfway leaves it halfway and scrolling up plays it back.
 */
export function WeekScroll({ title, moments }: { title: ReactNode; moments: WeekMoment[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, smooth);
  const n = moments.length;
  const [active, setActive] = useState(0);
  useMotionValueEvent(p, "change", (v) => setActive(Math.min(n - 1, Math.max(0, Math.floor(v * n)))));

  return (
    <div ref={ref} className="relative" style={{ height: `calc(${n * PER_STEP}svh + 100svh)` }}>
      <div className="sticky top-0 flex h-svh flex-col px-6 pt-[calc(var(--safe-top)+5.5rem)] pb-6 md:justify-center md:pt-16 md:pb-0">
        <div className="mx-auto grid w-full max-w-6xl min-h-0 flex-1 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-5 md:flex-none md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:grid-rows-1 md:items-center md:gap-16">
          <div className="contents md:block">
            {title}
            <div className="md:mt-10">
              <Progress p={p} n={n} />
            </div>
            <div className="relative h-[9.5rem] md:mt-8 md:h-[12rem]">
              {moments.map((m, i) => (
                <Copy key={m.id} moment={m} p={p} i={i} n={n} reduce={reduce} hidden={i !== active} />
              ))}
            </div>
          </div>
          <div className="relative min-h-0 md:h-[min(68svh,560px)]">
            {moments.map((m, i) => (
              <Screen key={m.id} p={p} i={i} n={n} reduce={reduce} hidden={i !== active}>
                {m.panel}
              </Screen>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Keyframes for moment i: rise in at its start, lift out at its end. The first starts shown, the last stays. */
function frames(i: number, n: number) {
  const seg = 1 / n;
  const start = i * seg;
  const end = start + seg;
  const edge = seg * EDGE;
  const at: number[] = [];
  const opacity: number[] = [];
  const phase: number[] = []; // 1 waiting below, 0 in place, -1 gone above
  if (i > 0) {
    at.push(start, start + edge);
    opacity.push(0, 1);
    phase.push(1, 0);
  }
  if (i < n - 1) {
    at.push(end - edge, end);
    opacity.push(1, 0);
    phase.push(0, -1);
  }
  return { at, opacity, phase };
}

function useMoment(p: MotionValue<number>, i: number, n: number) {
  const f = frames(i, n);
  return { opacity: useTransform(p, f.at, f.opacity), phase: useTransform(p, f.at, f.phase) };
}

function Copy({
  moment,
  p,
  i,
  n,
  reduce,
  hidden,
}: {
  moment: WeekMoment;
  p: MotionValue<number>;
  i: number;
  n: number;
  reduce: boolean;
  hidden: boolean;
}) {
  const { opacity, phase } = useMoment(p, i, n);
  const y = useTransform(phase, (v) => (reduce ? 0 : v > 0 ? v * 28 : v * 14));
  return (
    <motion.div aria-hidden={hidden} className="absolute inset-x-0 top-0" style={{ opacity, y }}>
      <p className="flex items-baseline gap-2.5">
        <span className="text-[15px] font-medium text-ink">{moment.day}</span>
        <span className="font-mono text-[15px] text-ink-3 tabular-nums">{moment.time}</span>
      </p>
      <p className="mt-3 max-w-[30rem] text-[17px] leading-[1.55] text-pretty text-ink-2 md:mt-4 md:text-[24px] md:leading-[1.4] md:text-ink">
        {moment.text}
      </p>
    </motion.div>
  );
}

function Screen({
  p,
  i,
  n,
  reduce,
  hidden,
  children,
}: {
  p: MotionValue<number>;
  i: number;
  n: number;
  reduce: boolean;
  hidden: boolean;
  children: ReactNode;
}) {
  const { opacity, phase } = useMoment(p, i, n);
  const y = useTransform(phase, (v) => (reduce ? 0 : v > 0 ? v * 64 : v * 40));
  const scale = useTransform(phase, (v) => (reduce ? 1 : 1 - Math.abs(v) * (v > 0 ? 0.06 : 0.04)));
  return (
    <motion.div
      aria-hidden={hidden}
      className="absolute inset-0 flex items-start justify-center will-change-transform md:items-center"
      style={{ opacity, y, scale }}
    >
      {children}
    </motion.div>
  );
}

/** One bar per moment; each fills as you scroll through its moment. */
function Progress({ p, n }: { p: MotionValue<number>; n: number }) {
  return (
    <div aria-hidden className="flex max-w-xs gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <Bar key={i} p={p} i={i} n={n} />
      ))}
    </div>
  );
}

function Bar({ p, i, n }: { p: MotionValue<number>; i: number; n: number }) {
  const scaleX = useTransform(p, [i / n, (i + 1) / n], [0, 1]);
  return (
    <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
      <motion.span className="block h-full origin-left rounded-full bg-accent" style={{ scaleX }} />
    </span>
  );
}
