"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Reveal, ease } from "./motion";

const LINE =
  "Most days start with a list and a guess. Timeo starts with an answer: what matters now, how much time is left, and what to do next.";
const STRONG = new Set(["answer:", "matters", "now,", "time", "left,", "next."]);

/** A sentence that lights up word by word as it scrolls past, then three plain answers. */
export function Certainty() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.5"] });
  const words = LINE.split(" ");

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
      <p ref={ref} className="display max-w-[22ch] text-[34px] leading-[1.12] tracking-[-0.015em] sm:text-[48px] lg:text-[58px]">
        <span className="sr-only">{LINE}</span>
        <span aria-hidden>
          {words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} strong={STRONG.has(w)}>
              {w}
            </Word>
          ))}
        </span>
      </p>

      <div className="mt-14 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Reveal delay={0} className="card p-5 sm:p-6">
          <p className="eyebrow">Time left</p>
          <p className="display tnum mt-3 text-[44px] leading-none">
            <Minutes to={220} />
          </p>
          <p className="mt-1.5 text-[14px] text-ink-2">free before 10 pm</p>
          <Bar value={0.62} tone="var(--accent)" />
        </Reveal>
        <Reveal delay={0.1} className="card p-5 sm:p-6">
          <p className="eyebrow">This season</p>
          <p className="display tnum mt-3 text-[44px] leading-none">
            Week <Count to={3} /> <span className="text-ink-3">of 12</span>
          </p>
          <p className="mt-1.5 text-[14px] text-ink-2">4h of 6h this week, on pace</p>
          <Bar value={4 / 6} tone="var(--ok)" />
        </Reveal>
        <Reveal delay={0.2} className="card p-5 sm:p-6">
          <p className="eyebrow">Up next</p>
          <p className="display tnum mt-3 text-[44px] leading-none">2:00 pm</p>
          <p className="mt-1.5 text-[14px] text-ink-2">Deep work on Ship v2, 90 min</p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink">Start focus</span>
            <span className="text-[13px] text-ink-3">in 25 min</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Word({
  progress,
  range,
  strong,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  strong: boolean;
  children: string;
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <>
      <motion.span style={{ opacity }} className={strong ? "italic text-accent" : undefined}>
        {children}
      </motion.span>{" "}
    </>
  );
}

function useCountUp(to: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  // starts at 0 on server and client alike (no hydration mismatch); reduced motion jumps straight to the end
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: reduce ? 0 : 1.6, ease, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce, to]);
  return { ref, value };
}

function Minutes({ to }: { to: number }) {
  const { ref, value } = useCountUp(to);
  return (
    <span ref={ref} className="tnum-live">
      {Math.floor(value / 60)}h {String(value % 60).padStart(2, "0")}m
    </span>
  );
}

function Count({ to }: { to: number }) {
  const { ref, value } = useCountUp(to);
  return (
    <span ref={ref} className="tnum-live">
      {value}
    </span>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-sunken">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ background: tone }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: value }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease, delay: 0.3 }}
      />
    </div>
  );
}
