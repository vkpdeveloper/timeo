"use client";

import Image from "next/image";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Clock } from "lucide-react";
import { PhoneFrame } from "./phone-frame";
import { Glow, SeasonRings, Words, ease } from "./motion";
import { cn } from "@/lib/cn";

export function Hero({ cta }: { cta: React.ReactNode }) {
  const { scrollY } = useScroll();
  const phoneY = useTransform(scrollY, [0, 900], [0, -90]);
  const ringsY = useTransform(scrollY, [0, 900], [0, 120]);
  const ringsScale = useTransform(scrollY, [0, 900], [1, 1.12]);
  const copyY = useTransform(scrollY, [0, 600], [0, 50]);
  const copyOpacity = useTransform(scrollY, [0, 500], [1, 0.2]);

  return (
    <section className="relative">
      <Glow className="-top-48 left-1/2 size-[640px] -translate-x-1/2 opacity-80 lg:left-[70%]" />
      <div className="relative mx-auto grid max-w-6xl gap-6 px-5 pt-10 pb-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-8 lg:pt-12 lg:pb-24">
        <motion.div style={{ y: copyY, opacity: copyOpacity }} className="text-center lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pr-3.5 pl-2 text-[13px] text-ink-2"
          >
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase">
              12 weeks
            </span>
            Goal · Plan · System
          </motion.p>

          <h1 className="display mt-5 text-[46px] leading-[0.98] tracking-[-0.02em] sm:text-[64px] lg:text-[80px]">
            <Words
              text="Always know what to do next."
              delay={0.2}
              accentFrom={4}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.75 }}
            className="mx-auto mt-5 max-w-[34ch] text-[17px] leading-relaxed text-ink-2 sm:text-[19px] lg:mx-0"
          >
            Pick two or three goals for twelve weeks. Timeo turns them into time on your calendar and tells you what’s next.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.9 }}
            className="mt-8 flex justify-center lg:justify-start"
          >
            {cta}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="mt-4 text-[13px] text-ink-3"
          >
            Free to start. Installs from your browser.
          </motion.p>
        </motion.div>

        <div className="relative mx-auto flex h-[600px] w-full max-w-[420px] items-center justify-center [perspective:1400px] sm:h-[680px] lg:h-[720px] lg:max-w-none">
          <motion.div style={{ y: ringsY, scale: ringsScale }} className="absolute inset-0 flex items-center justify-center">
            <SeasonRings className="size-[560px] shrink-0 opacity-90 sm:size-[680px]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 80, rotateX: 22, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            transition={{ duration: 1.2, ease, delay: 0.35 }}
            className="relative"
          >
            <motion.div style={{ y: phoneY }}>
              <PhoneFrame
                src="/landing/today.png"
                alt="Timeo's Today screen"
                priority
                sizes="(min-width: 1024px) 320px, 270px"
                className="w-[262px] sm:w-[300px] lg:w-[320px]"
              />
            </motion.div>
          </motion.div>

          <Chip scrollY={scrollY} i={0} className="top-[19%] -left-1 sm:left-0 lg:top-[10%] lg:-left-10">
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
              <Clock className="size-4" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="tnum block font-semibold text-ink">3h 40m free</span>
              <span className="text-[12px] text-ink-3">before 10 pm</span>
            </span>
          </Chip>

          <Chip scrollY={scrollY} i={1} className="top-[44%] -right-1 sm:right-0 lg:-right-4">
            <WeekRing />
            <span className="leading-tight">
              <span className="tnum block font-semibold text-ink">Week 4 of 12</span>
              <span className="text-[12px] text-ok">On pace</span>
            </span>
          </Chip>

          <Chip scrollY={scrollY} i={2} className="bottom-[13%] left-0 lg:bottom-[16%] lg:-left-10">
            <Image src="/mascots/timi-avatar.png" alt="" width={32} height={32} className="size-8 rounded-full bg-[#f3eee6]" />
            <span className="leading-tight">
              <span className="tnum block font-semibold text-ink">Bench 4×8 at 60 kg</span>
              <span className="text-[12px] text-ink-3">Logged by Timi</span>
            </span>
          </Chip>
        </div>
      </div>
    </section>
  );
}

function Chip({
  i,
  scrollY,
  className,
  children,
}: {
  i: number;
  scrollY: MotionValue<number>;
  className?: string;
  children: React.ReactNode;
}) {
  const y = useTransform(scrollY, [0, 900], [0, -60 - i * 50]);
  const fromLeft = i !== 1;
  return (
    <motion.div style={{ y }} className={cn("absolute z-10", className)}>
      <motion.div
        initial={{ opacity: 0, x: fromLeft ? -28 : 28, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: 1.1 + i * 0.28 }}
      >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5 + i * 1.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
          className="glass flex items-center gap-2.5 rounded-2xl border border-line-strong py-2 pr-4 pl-2 text-[14px] shadow-float"
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function WeekRing() {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 32 32" className="size-8 -rotate-90" aria-hidden>
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="3" />
      <motion.circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="var(--ok)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - 3 / 12) }}
        transition={{ duration: 1.4, ease, delay: 1.6 }}
      />
    </svg>
  );
}
