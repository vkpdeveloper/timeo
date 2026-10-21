"use client";

import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/components/ui/motion";

/** Smooths raw scroll progress so steps glide in rather than track every wheel tick. */
const smooth = { stiffness: 170, damping: 30, mass: 0.5 };

/** Opacity and rise for one part of a step, over a slice of the step's scroll progress. */
function useRise(p: MotionValue<number>, from: number, to: number, distance: number) {
  return {
    opacity: useTransform(p, [from, to], [0, 1]),
    y: useTransform(p, [from, to], [distance, 0]),
  };
}

/** The week's rail: a hairline that fills with the accent as you scroll through the steps. */
export function Timeline({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.6", "end 0.6"] });
  const fill = useSpring(scrollYProgress, smooth);
  return (
    <ol ref={ref} className="relative mt-10 sm:mt-16">
      <span aria-hidden className="absolute inset-y-0 left-[3px] w-px bg-line" />
      <motion.span
        aria-hidden
        className="absolute inset-y-0 left-[3px] w-px origin-top bg-accent"
        style={{ scaleY: reduce ? 1 : fill }}
      />
      {children}
    </ol>
  );
}

/**
 * One moment of the week. As it scrolls up, the time, then the text, then the
 * screen rise into line, tied to scroll position so it plays back in reverse.
 */
export function TimelineStep({ when, text, panel }: { when: ReactNode; text: ReactNode; panel: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.95", "start 0.4"] });
  const p = useSpring(scrollYProgress, smooth);
  const whenStyle = useRise(p, 0, 0.55, 24);
  const textStyle = useRise(p, 0.12, 0.7, 32);
  const panelStyle = { ...useRise(p, 0.25, 1, 56), scale: useTransform(p, [0.25, 1], [0.96, 1]) };
  const dot = useTransform(p, [0.2, 0.55], [0, 1]);

  return (
    <li
      ref={ref}
      className="grid gap-5 py-8 pl-7 sm:py-12 md:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10 md:pl-10"
    >
      <motion.div className="relative" style={reduce ? undefined : whenStyle}>
        <span aria-hidden className="absolute top-[8px] -left-7 grid size-[7px] place-items-center rounded-full bg-line md:-left-10">
          <motion.span className="size-full rounded-full bg-accent" style={{ scale: reduce ? 1 : dot }} />
        </span>
        {when}
      </motion.div>
      <motion.div style={reduce ? undefined : textStyle}>{text}</motion.div>
      <motion.div className="origin-top will-change-transform" style={reduce ? undefined : panelStyle}>
        {panel}
      </motion.div>
    </li>
  );
}
