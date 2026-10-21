"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowUp, Bell, Check, Mic } from "lucide-react";
import { Reveal, Words, ease } from "./motion";
import { cn } from "@/lib/cn";

type Phase = "typing" | "running" | "done";

const COMMANDS = [
  { text: "Bench 4×8 at 60", result: <SetsResult />, note: "4 sets logged" },
  { text: "Plan my week", result: <WeekResult />, note: "6 blocks placed" },
  { text: "Lunch: dal, rice and curd", result: <MealResult />, note: "Lunch logged, 640 kcal" },
];

export function Timi() {
  return (
    <section id="timi" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <Reveal className="flex items-center gap-3">
            <Image src="/mascots/timi-avatar.png" alt="" width={44} height={44} className="size-11 rounded-full bg-[#f3eee6]" />
            <p className="eyebrow">Meet Timi</p>
          </Reveal>
          <h2 className="display mt-4 text-[40px] leading-[1.02] tracking-[-0.015em] sm:text-[56px]">
            <Words text="Say it once. It’s done." inView accentFrom={3} />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-ink-2">
              Type or talk to Timi like you would to a friend who knows your plan. It logs, plans and moves things for you.
            </p>
          </Reveal>
          <ul className="mt-8 space-y-3">
            {[
              "Runs in the background, so you can close the app",
              "Sends a notification when it’s done",
              "Knows your goals, calendar and training",
            ].map((t, i) => (
              <Reveal key={t} delay={0.15 + i * 0.08}>
                <li className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal y={30}>
          <Demo />
        </Reveal>
      </div>
    </section>
  );
}

function Demo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const cmd = COMMANDS[index];

  useEffect(() => {
    if (!inView) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (reduce) {
        t = setTimeout(() => {
          setTyped(cmd.text.length);
          setPhase("running");
        }, 300);
      } else if (typed < cmd.text.length) {
        t = setTimeout(() => setTyped((n) => n + 1), 45 + Math.random() * 55);
      } else {
        t = setTimeout(() => setPhase("running"), 450);
      }
    } else if (phase === "running") {
      t = setTimeout(() => setPhase("done"), 1300);
    } else {
      t = setTimeout(() => {
        setIndex((i) => (i + 1) % COMMANDS.length);
        setTyped(0);
        setPhase("typing");
      }, 4200);
    }
    return () => clearTimeout(t);
  }, [inView, phase, typed, cmd.text.length, reduce]);

  const pick = (i: number) => {
    setIndex(i);
    setTyped(0);
    setPhase("typing");
  };

  return (
    <div ref={ref} className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[40px] opacity-70 blur-2xl"
        style={{ background: "radial-gradient(60% 60% at 70% 30%, var(--accent-soft), transparent)" }}
      />
      <div className="card relative overflow-hidden p-3 sm:p-4">
        {/* Notification */}
        <div className="relative h-[60px]">
          <AnimatePresence>
            {phase === "done" ? (
              <motion.div
                key={`n-${index}`}
                initial={{ opacity: 0, y: -18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.5 }}
                className="absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-accent text-accent-ink">
                  <Bell className="size-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13px] font-semibold">Timi</span>
                  <span className="block truncate text-[13px] text-ink-2">Done. {cmd.note}.</span>
                </span>
                <span className="text-[11px] text-ink-3">now</span>
              </motion.div>
            ) : (
              <motion.p
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center gap-2 px-2 text-[13px]"
              >
                <span className={cn("size-2 rounded-full", phase === "running" ? "animate-pulse bg-accent" : "bg-ok")} />
                <span className="font-semibold">Timi</span>
                <span className="text-ink-3">{phase === "running" ? "Working" : "Ready"}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Result area */}
        <div className="relative mt-2 min-h-[318px] rounded-[18px] bg-surface-2 p-4">
          <AnimatePresence mode="wait">
            {phase === "running" ? (
              <motion.div
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-[286px] flex-col items-center justify-center gap-3 text-center"
              >
                <span className="flex gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="size-2 rounded-full bg-accent"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                    />
                  ))}
                </span>
                <span className="text-[14px] text-ink-2">Working in the background</span>
                <span className="text-[12px] text-ink-3">You can close the app</span>
              </motion.div>
            ) : phase === "done" ? (
              <motion.div
                key={`r-${index}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease }}
              >
                {cmd.result}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-[286px] flex-col items-center justify-center gap-3"
              >
                <Image src="/mascots/timi-avatar.png" alt="" width={64} height={64} className="size-16 rounded-full bg-[#f3eee6]" />
                <span className="text-[14px] text-ink-3">Listening</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Command bar */}
        <div className="mt-3 flex h-14 items-center gap-3 rounded-full border border-line-strong bg-surface pr-1.5 pl-2">
          <Image src="/mascots/timi-avatar.png" alt="" width={36} height={36} className="size-9 rounded-full bg-[#f3eee6]" />
          <p className="min-w-0 flex-1 truncate text-[16px]" aria-live="polite">
            {typed === 0 && phase === "typing" ? (
              <span className="text-ink-3">Ask Timi</span>
            ) : (
              <span>{cmd.text.slice(0, typed)}</span>
            )}
            {phase === "typing" ? (
              <motion.span
                aria-hidden
                className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-accent"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            ) : null}
          </p>
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300",
              typed > 0 && phase === "typing" ? "bg-accent text-accent-ink" : "bg-sunken text-ink-2",
            )}
          >
            {typed > 0 && phase === "typing" ? <ArrowUp className="size-5" strokeWidth={2.2} /> : <Mic className="size-5" />}
          </span>
        </div>
      </div>

      {/* Prompts */}
      <div className="relative mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
        {COMMANDS.map((c, i) => (
          <button
            key={c.text}
            type="button"
            onClick={() => pick(i)}
            className={cn(
              "tap h-11 rounded-full border px-4 text-[14px] transition-colors",
              i === index ? "border-accent/40 bg-accent-soft text-ink" : "border-line text-ink-2 hover:text-ink",
            )}
          >
            “{c.text}”
          </button>
        ))}
      </div>
    </div>
  );
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease, delay: 0.15 + i * 0.08 },
});

function SetsResult() {
  return (
    <div>
      <p className="eyebrow">Logged to Push day</p>
      <p className="mt-1 text-[20px] font-semibold">Bench press</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((s, i) => (
          <motion.div key={s} {...rise(i)} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
            <span className="text-[12px] text-ink-3">Set {s}</span>
            <span className="tnum text-[15px] font-semibold">8 × 60 kg</span>
          </motion.div>
        ))}
      </div>
      <motion.div {...rise(5)} className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
        <span className="text-ink-2">Volume</span>
        <span className="tnum font-semibold">1,920 kg</span>
      </motion.div>
      <motion.div {...rise(6)} className="mt-1.5 flex items-center justify-between text-[13px]">
        <span className="text-ink-2">Next time</span>
        <span className="tnum font-semibold text-ok">Try 62.5 kg</span>
      </motion.div>
    </div>
  );
}

function WeekResult() {
  const rows = [
    { day: "Mon", time: "9:00", what: "Deep work · Ship v2", tone: "var(--c-coral)" },
    { day: "Tue", time: "7:00", what: "Easy run · 10K", tone: "var(--c-sage)" },
    { day: "Wed", time: "9:00", what: "Deep work · Ship v2", tone: "var(--c-coral)" },
    { day: "Thu", time: "21:00", what: "Read · 40 pages", tone: "var(--c-sky)" },
    { day: "Sat", time: "8:00", what: "Long run · 10K", tone: "var(--c-sage)" },
  ];
  return (
    <div>
      <p className="eyebrow">This week</p>
      <p className="mt-1 text-[20px] font-semibold">6 blocks placed</p>
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r, i) => (
          <motion.div key={r.day} {...rise(i)} className="flex items-center gap-3 px-3 py-2">
            <span className="h-6 w-1 rounded-full" style={{ background: r.tone }} />
            <span className="w-9 text-[13px] font-semibold">{r.day}</span>
            <span className="tnum w-11 text-[13px] text-ink-3">{r.time}</span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{r.what}</span>
          </motion.div>
        ))}
      </div>
      <motion.p {...rise(6)} className="mt-3 text-[13px] text-ink-2">
        11h planned, 14h still free
      </motion.p>
    </div>
  );
}

function MealResult() {
  const macros = [
    { name: "Protein", value: "28 g", of: "of 120 g", pct: 0.23, tone: "var(--c-coral)" },
    { name: "Carbs", value: "96 g", of: "of 240 g", pct: 0.4, tone: "var(--c-amber)" },
    { name: "Fat", value: "16 g", of: "of 70 g", pct: 0.23, tone: "var(--c-sky)" },
  ];
  return (
    <div>
      <p className="eyebrow">Lunch</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="display tnum text-[40px] leading-none">640</span>
        <span className="text-[14px] text-ink-2">kcal · 1,320 left today</span>
      </p>
      <div className="mt-5 space-y-3.5">
        {macros.map((m, i) => (
          <motion.div key={m.name} {...rise(i)}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{m.name}</span>
              <span className="tnum text-ink-3">
                <span className="font-semibold text-ink">{m.value}</span> {m.of}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ background: m.tone }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: m.pct }}
                transition={{ duration: 0.9, ease, delay: 0.3 + i * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
