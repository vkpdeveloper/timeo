"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Timi } from "@/components/ai/timi";
import { useReducedMotion } from "@/components/ui/motion";
import { colorVar } from "@/lib/colors";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const ROWS = 9;

type Block = { day: number; row: number; span: number; color: string; label: string };

const pine = colorVar("pine");
const sky = colorVar("sky");
const sand = colorVar("sand");
const teal = colorVar("teal");

/** Three weeks that each fill up differently, played one after another. */
const WEEKS: { total: string; blocks: Block[] }[] = [
  {
    total: "14h toward 3 goals",
    blocks: [
      { day: 0, row: 0, span: 2, color: sky, label: "Write" },
      { day: 1, row: 1, span: 2, color: teal, label: "Run" },
      { day: 2, row: 0, span: 2, color: sky, label: "Write" },
      { day: 3, row: 5, span: 2, color: sand, label: "Read" },
      { day: 4, row: 0, span: 2, color: sky, label: "Write" },
      { day: 0, row: 6, span: 1, color: sand, label: "Read" },
      { day: 2, row: 6, span: 1, color: teal, label: "Run" },
      { day: 5, row: 2, span: 3, color: teal, label: "Long run" },
      { day: 1, row: 5, span: 2, color: pine, label: "Gym" },
      { day: 3, row: 1, span: 2, color: pine, label: "Gym" },
      { day: 6, row: 4, span: 2, color: sand, label: "Read" },
      { day: 4, row: 4, span: 2, color: pine, label: "Gym" },
    ],
  },
  {
    total: "11h toward 2 goals",
    blocks: [
      { day: 0, row: 1, span: 3, color: sky, label: "Ship" },
      { day: 2, row: 1, span: 3, color: sky, label: "Ship" },
      { day: 4, row: 1, span: 2, color: sky, label: "Ship" },
      { day: 1, row: 6, span: 2, color: sand, label: "Spanish" },
      { day: 3, row: 6, span: 2, color: sand, label: "Spanish" },
      { day: 5, row: 0, span: 2, color: teal, label: "Hike" },
      { day: 6, row: 3, span: 2, color: sand, label: "Review" },
      { day: 1, row: 0, span: 1, color: pine, label: "Gym" },
      { day: 3, row: 0, span: 1, color: pine, label: "Gym" },
    ],
  },
  {
    total: "16h toward 3 goals",
    blocks: [
      { day: 0, row: 0, span: 2, color: pine, label: "Gym" },
      { day: 1, row: 2, span: 3, color: sky, label: "Thesis" },
      { day: 2, row: 0, span: 2, color: pine, label: "Gym" },
      { day: 3, row: 2, span: 3, color: sky, label: "Thesis" },
      { day: 4, row: 0, span: 2, color: pine, label: "Gym" },
      { day: 0, row: 4, span: 2, color: teal, label: "Piano" },
      { day: 2, row: 4, span: 2, color: teal, label: "Piano" },
      { day: 4, row: 5, span: 2, color: sky, label: "Thesis" },
      { day: 5, row: 1, span: 3, color: sky, label: "Thesis" },
      { day: 6, row: 6, span: 2, color: teal, label: "Piano" },
      { day: 1, row: 7, span: 1, color: sand, label: "Plan" },
    ],
  },
];

const STEP = 0.26; // s between blocks

/**
 * Sunday evening, sped up: blocks drop into the week and settle into their
 * slots until the week is planned, then the next week starts.
 */
export function WeekWallLook() {
  const reduce = useReducedMotion();
  const [round, setRound] = useState(0);
  const [filled, setFilled] = useState(false);
  const week = WEEKS[round % WEEKS.length];

  useEffect(() => {
    const fill = window.setTimeout(() => setFilled(true), (week.blocks.length * STEP + 0.6) * 1000);
    const next = window.setTimeout(
      () => {
        setFilled(false);
        setRound((r) => r + 1);
      },
      (week.blocks.length * STEP + 3.8) * 1000,
    );
    return () => {
      window.clearTimeout(fill);
      window.clearTimeout(next);
    };
  }, [round, week.blocks.length]);

  return (
    <div className="flex w-full flex-col p-12 xl:p-16">
      <div className="flex flex-1 items-center justify-center pb-10">
        <div className="w-full max-w-[520px]">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13.5px] font-medium text-ink-3">Sunday, 19:00</span>
            <motion.span
              className="text-[13.5px] font-medium text-ink"
              animate={{ opacity: filled ? 1 : 0, y: filled ? 0 : 4 }}
              transition={{ duration: 0.4 }}
            >
              {week.total}
            </motion.span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 pb-2">
            {DAYS.map((d, i) => (
              <span key={i} className="text-center font-mono text-[12px] text-ink-3">
                {d}
              </span>
            ))}
          </div>
          <div className="relative aspect-[7/6] w-full overflow-hidden rounded-[16px] border border-line bg-bg">
            {/* empty slots */}
            <div className="absolute inset-0 grid grid-cols-7">
              {DAYS.map((_, i) => (
                <div key={i} className="border-r border-line last:border-r-0" />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={round} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.5 } }}>
                {week.blocks.map((b, i) => (
                  <motion.div
                    key={i}
                    className="absolute p-[3px]"
                    style={{
                      left: `${(b.day / 7) * 100}%`,
                      width: `${100 / 7}%`,
                      top: `${(b.row / ROWS) * 100}%`,
                      height: `${(b.span / ROWS) * 100}%`,
                    }}
                    initial={reduce ? { opacity: 0 } : { y: -520, opacity: 0, rotate: i % 2 ? 6 : -6 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9, delay: i * STEP }}
                  >
                    <div
                      className="flex size-full flex-col justify-start rounded-[8px] px-1.5 py-1 text-[10.5px] leading-tight font-semibold"
                      style={{
                        background: `color-mix(in oklab, ${b.color} 22%, var(--surface))`,
                        boxShadow: `inset 2px 0 0 ${b.color}`,
                        color: "var(--ink)",
                      }}
                    >
                      {b.label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[520px] items-end justify-between gap-8">
        <div className="max-w-[340px]">
          <p className="text-[24px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-ink">The week fills itself.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-pretty text-ink-2">
            Tell Timeo your goals and the hours they need. It finds them a place before Monday.
          </p>
        </div>
        <Timi size={72} mood={filled ? "happy" : "thinking"} className="-mb-1" />
      </div>
    </div>
  );
}
