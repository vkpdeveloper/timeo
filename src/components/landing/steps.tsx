"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Reveal, Words, ease } from "./motion";

const STEPS = [
  {
    n: "01",
    title: "Pick 2–3 goals",
    body: "For the next twelve weeks. Each one gets a plan and a weekly system.",
    art: <GoalsArt />,
  },
  {
    n: "02",
    title: "Block the time",
    body: "Put the work on your calendar. Timeo shows how much of the week is left.",
    art: <CalendarArt />,
  },
  {
    n: "03",
    title: "Show up and review",
    body: "Focus on one block at a time. A five-minute review each week keeps you on pace.",
    art: <ReviewArt />,
  },
];

export function Steps() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-6 sm:py-24">
      <Reveal>
        <p className="eyebrow">How it works</p>
      </Reveal>
      <h2 className="display mt-3 max-w-[18ch] text-[36px] leading-[1.04] tracking-[-0.015em] sm:text-[52px]">
        <Words text="Three steps. Twelve weeks." inView />
      </h2>

      <div className="mt-10 grid gap-3 sm:mt-14 md:grid-cols-3 md:gap-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12} className="card flex flex-col overflow-hidden">
            <div className="relative h-[184px] border-b border-line bg-surface-2 px-5 pt-5">{s.art}</div>
            <div className="p-5 sm:p-6">
              <p className="tnum text-[13px] font-semibold text-accent">{s.n}</p>
              <h3 className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const inView = { once: true, margin: "0px 0px -10% 0px" } as const;

function GoalsArt() {
  const goals = [
    { name: "Ship Timeo v2", tone: "var(--c-coral)", pct: 0.42 },
    { name: "Run a 10K", tone: "var(--c-sage)", pct: 0.3 },
    { name: "Read 12 books", tone: "var(--c-sky)", pct: 0.25 },
  ];
  return (
    <div className="space-y-2">
      {goals.map((g, i) => (
        <motion.div
          key={g.name}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={inView}
          transition={{ duration: 0.6, ease, delay: 0.25 + i * 0.12 }}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
        >
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.tone }} />
          <span className="flex-1 truncate text-[14px] font-medium">{g.name}</span>
          <span className="h-1 w-14 overflow-hidden rounded-full bg-sunken">
            <motion.span
              className="block h-full origin-left rounded-full"
              style={{ background: g.tone }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: g.pct }}
              viewport={inView}
              transition={{ duration: 1, ease, delay: 0.6 + i * 0.12 }}
            />
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function CalendarArt() {
  const days = ["M", "T", "W", "T", "F"];
  // [day, startRow, rows, tone]
  const blocks: [number, number, number, string][] = [
    [0, 0, 3, "var(--c-coral)"],
    [1, 2, 2, "var(--c-sage)"],
    [2, 0, 3, "var(--c-coral)"],
    [3, 1, 2, "var(--c-sky)"],
    [4, 0, 2, "var(--c-coral)"],
    [0, 4, 1, "var(--c-sage)"],
    [2, 4, 1, "var(--c-sky)"],
  ];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {days.map((d, i) => (
        <p key={i} className="text-center text-[11px] font-semibold text-ink-3">
          {d}
        </p>
      ))}
      <div className="relative col-span-5 grid h-[128px] grid-cols-5 grid-rows-5 gap-1.5">
        {Array.from({ length: 25 }, (_, i) => (
          <span key={i} className="rounded-md border border-dashed border-line" />
        ))}
        {blocks.map(([day, row, span, tone], i) => (
          <motion.span
            key={i}
            className="absolute origin-top rounded-md"
            style={{
              background: `color-mix(in oklab, ${tone} 85%, transparent)`,
              left: `calc(${day} * (100% + 6px) / 5)`,
              width: "calc((100% - 24px) / 5)",
              top: `calc(${row} * (100% + 6px) / 5)`,
              height: `calc(${span} * (100% - 24px) / 5 + ${(span - 1) * 6}px)`,
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={inView}
            transition={{ duration: 0.55, ease, delay: 0.3 + i * 0.09 }}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewArt() {
  const items = ["Deep work, 4 blocks", "Long run, 8 km", "Read 60 pages"];
  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-2">
        {items.map((t, i) => (
          <div key={t} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
            <motion.span
              className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={inView}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.4 + i * 0.25 }}
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
            <span className="truncate text-[13px] font-medium">{t}</span>
          </div>
        ))}
      </div>
      <div className="hidden w-[84px] shrink-0 flex-col items-center justify-center sm:flex md:hidden lg:flex">
        <ScoreRing />
      </div>
    </div>
  );
}

function ScoreRing() {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[84px]">
      <svg viewBox="0 0 84 84" className="size-full -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="6" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--ok)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * 0.18 }}
          viewport={inView}
          transition={{ duration: 1.4, ease, delay: 0.5 }}
        />
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-[18px] font-semibold">82%</span>
    </div>
  );
}
