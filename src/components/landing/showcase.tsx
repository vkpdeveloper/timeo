"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { PhoneFrame } from "./phone-frame";
import { Glow, ease } from "./motion";
import { cn } from "@/lib/cn";

const FEATURES = [
  {
    key: "today",
    label: "Today",
    title: "Know what’s left",
    body: "Free time, blocks left and tasks due, in one line. The next thing is one tap away.",
  },
  {
    key: "plan",
    label: "Plan",
    title: "Block the time",
    body: "Give each goal a slot on your calendar. See the week fill up before it happens.",
  },
  {
    key: "goals",
    label: "Goals",
    title: "Two or three goals",
    body: "Each goal has a plan and a weekly system. See if you’re on pace, every week of the season.",
  },
  {
    key: "focus",
    label: "Focus",
    title: "One thing, full attention",
    body: "Start a session from any block. A quiet timer, and the time counts toward your goal.",
  },
  {
    key: "review",
    label: "Review",
    title: "Look back in five minutes",
    body: "What moved, what slipped, what’s next. Adjust the plan and start the week clear.",
  },
  {
    key: "fitness",
    label: "Fitness",
    title: "Train and eat to plan",
    body: "Routines, a weekly split and set logging. Meals and protein, without a spreadsheet.",
  },
  {
    key: "assistant",
    label: "Timi",
    title: "Just ask",
    body: "Type or talk. Timi plans your week, logs sets and meals, and tells you when it’s done.",
  },
] as const;

const STEP_VH = 65;

/** A sticky phone that swaps screens as the feature copy scrolls by. */
export function Showcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.min(FEATURES.length - 1, Math.max(0, Math.floor(v * FEATURES.length)));
    setActive((prev) => (prev === i ? prev : i));
  });

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / FEATURES.length) * span, behavior: "smooth" });
  };

  const f = FEATURES[active];

  return (
    <section
      id="tour"
      ref={ref}
      className="relative"
      style={{ height: `calc(${FEATURES.length * STEP_VH}vh + 100dvh)` }}
      aria-label="A tour of Timeo"
    >
      <div className="sticky top-0 flex h-dvh flex-col">
        <Glow className="top-1/3 left-1/2 size-[520px] -translate-x-1/2 opacity-60 lg:left-[68%]" />
        <div className="relative mx-auto grid h-full w-full max-w-6xl grid-rows-[1fr_auto] gap-4 px-5 pt-[calc(56px+20px+var(--safe-top))] pb-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:grid-rows-1 lg:items-center lg:gap-16 lg:pt-16 lg:pb-0">
          {/* Copy */}
          <div className="order-2 flex flex-col lg:order-1">
            <p className="eyebrow hidden lg:block">A tour</p>
            <h2 className="display mt-3 hidden max-w-[16ch] text-[52px] leading-[1.02] tracking-[-0.015em] lg:block">
              One calm app for the whole season.
            </h2>

            {/* Desktop: the full list, active one expanded */}
            <ol className="mt-10 hidden border-l border-line lg:block">
              {FEATURES.map((x, i) => (
                <li key={x.key} className="relative">
                  {i === active ? (
                    <motion.span
                      layoutId="tour-rail"
                      className="absolute top-0 -left-px h-full w-0.5 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => jump(i)}
                    className={cn(
                      "block w-full py-2.5 pl-6 text-left transition-colors duration-300",
                      i === active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="text-[13px] font-semibold tracking-wide uppercase">{x.label}</span>
                      <span className={cn("text-[17px] font-medium transition-opacity", i === active ? "opacity-100" : "opacity-0")}>
                        {x.title}
                      </span>
                    </span>
                    <AnimatePresence initial={false}>
                      {i === active ? (
                        <motion.span
                          key="body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease }}
                          className="block overflow-hidden"
                        >
                          <span className="block max-w-[44ch] pt-1.5 text-[16px] leading-relaxed text-ink-2">{x.body}</span>
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </button>
                </li>
              ))}
            </ol>

            {/* Mobile: progress, then the active copy */}
            <div className="lg:hidden">
              <div className="flex gap-1.5" aria-hidden>
                {FEATURES.map((x, i) => (
                  <span key={x.key} className="h-1 flex-1 overflow-hidden rounded-full bg-line-strong">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-accent"
                      animate={{ scaleX: i <= active ? 1 : 0 }}
                      transition={{ duration: 0.4, ease }}
                    />
                  </span>
                ))}
              </div>
              <div className="relative mt-4 min-h-[124px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={f.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease }}
                  >
                    <p className="text-[12px] font-semibold tracking-wide text-accent uppercase">{f.label}</p>
                    <h3 className="display mt-1 text-[30px] leading-[1.05]">{f.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="relative order-1 flex min-h-0 items-center justify-center lg:order-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease }}
              className="h-full max-h-[720px] lg:h-[min(720px,calc(100dvh-140px))]"
            >
              <PhoneFrame className="h-full">
                {FEATURES.map((x, i) => (
                  <motion.div
                    key={x.key}
                    className="absolute inset-0"
                    initial={false}
                    animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.04 }}
                    transition={{ duration: 0.55, ease }}
                  >
                    <Image
                      src={`/landing/${x.key}.png`}
                      alt={i === active ? `Timeo ${x.label} screen` : ""}
                      fill
                      sizes="(min-width: 1024px) 340px, 240px"
                      className="object-cover object-top"
                    />
                  </motion.div>
                ))}
              </PhoneFrame>
            </motion.div>
            {/* Scroll progress ring, desktop */}
            <svg viewBox="0 0 40 40" className="absolute -right-14 bottom-8 hidden size-10 -rotate-90 lg:block" aria-hidden>
              <circle cx="20" cy="20" r="17" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
              <motion.circle cx="20" cy="20" r="17" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: progress }} />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
