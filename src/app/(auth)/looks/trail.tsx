"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Timi } from "@/components/ai/timi";
import markers from "../../../../public/auth/trail-markers.json";

const IMG = { w: 1024, h: 1536 };
type Pt = { x: number; y: number };
const STOPS: Pt[] = [...(markers.markers as Pt[]), markers.flag as Pt];

/** How far along the form is: each field counts once it has a few characters. */
function formProgress(): number {
  const inputs = [...document.querySelectorAll<HTMLInputElement>("main form input:not([type=hidden])")];
  if (!inputs.length) return 0;
  const sum = inputs.reduce((s, i) => s + Math.min(i.value.length / 8, 1), 0);
  return sum / inputs.length;
}

/**
 * A season as a trail: twelve stones, one per week, and a flag at the top.
 * Timi walks up as you fill the form and reaches the flag when you submit.
 */
export function TrailLook() {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [step, setStep] = useState(0);
  const [summit, setSummit] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    const onInput = () => setStep(Math.round(formProgress() * (STOPS.length - 2)));
    const onSubmit = () => setSummit(true);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      ro.disconnect();
      document.removeEventListener("input", onInput);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // The trail is taller than the panel: fit its width and pan so Timi stays a little below the middle.
  const scale = size.w / IMG.w;
  const imgH = IMG.h * scale;
  const at = STOPS[summit ? STOPS.length - 1 : step];
  const pan = Math.min(0, Math.max(size.h - imgH, size.h * 0.6 - at.y * scale));
  const week = summit ? 12 : step + 1;
  const spring = { type: "spring", stiffness: 90, damping: 20 } as const;

  return (
    <div ref={box} className="relative w-full overflow-hidden">
      {size.w > 0 && (
        <motion.div className="absolute inset-x-0 top-0" style={{ height: imgH }} initial={false} animate={{ y: pan }} transition={spring}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/auth/trail-light.webp" alt="" className="absolute inset-0 size-full dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/auth/trail-dark.webp" alt="" className="absolute inset-0 hidden size-full dark:block" />
          <motion.div
            className="absolute z-10 -translate-x-1/2 -translate-y-[88%]"
            initial={false}
            animate={{ left: at.x * scale, top: at.y * scale }}
            transition={spring}
          >
            <Timi size={64} mood={summit ? "happy" : "idle"} interactive />
          </motion.div>
        </motion.div>
      )}

      <div className="absolute top-8 left-8 z-10 rounded-[14px] bg-bg/85 px-4 py-3">
        <div className="font-mono text-[13px] text-ink-3 tabular-nums">Week {week} of 12</div>
        <div className="mt-0.5 text-[15px] font-semibold text-ink">{summit ? "Season planned" : "Keep going"}</div>
      </div>
      <div className="absolute right-8 bottom-8 left-8 z-10 max-w-[380px] rounded-[16px] bg-bg/85 px-5 py-4">
        <p className="text-[22px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">Twelve weeks, one step at a time.</p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">Every field you fill moves Timi up the trail.</p>
      </div>
    </div>
  );
}
