"use client";

import { animate, motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect } from "react";
import { Timi } from "@/components/ai/timi";
import { useReducedMotion } from "@/components/ui/motion";

type Obj = { src: string; size: number; left: string; top: string; depth: number; tilt: number; float: number };

const OBJECTS: Obj[] = [
  { src: "/auth/obj-clock.webp", size: 210, left: "8%", top: "10%", depth: 1, tilt: -8, float: 6.5 },
  { src: "/auth/obj-hourglass.webp", size: 170, left: "70%", top: "6%", depth: 0.6, tilt: 10, float: 7.5 },
  { src: "/auth/obj-block.webp", size: 190, left: "64%", top: "60%", depth: 1.3, tilt: 6, float: 5.8 },
  { src: "/auth/obj-flag.webp", size: 150, left: "12%", top: "66%", depth: 0.8, tilt: -4, float: 8.2 },
];

function Floater({
  o,
  px,
  py,
  kick,
  i,
}: {
  o: Obj;
  px: MotionValue<number>;
  py: MotionValue<number>;
  kick: MotionValue<number>;
  i: number;
}) {
  const x = useTransform(px, (v) => v * 40 * o.depth);
  const y = useTransform(py, (v) => v * 30 * o.depth);
  const rotate = useTransform(kick, (k) => o.tilt + k * (i % 2 ? -1 : 1) * o.depth);
  return (
    <motion.div className="absolute" style={{ left: o.left, top: o.top, width: o.size, height: o.size, x, y, rotate }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={o.src}
        alt=""
        className="auth-float size-full object-contain select-none"
        style={{ animationDuration: `${o.float}s`, animationDelay: `${-i * 1.7}s` }}
        draggable={false}
      />
    </motion.div>
  );
}

/**
 * The tools of a planned week, floating. They lean away from the pointer and
 * wobble with every key you type.
 */
export function ObjectsLook() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 50, damping: 16 });
  const py = useSpring(my, { stiffness: 50, damping: 16 });
  const kick = useMotionValue(0);

  useEffect(() => {
    if (reduce) return;
    const onKey = () => {
      kick.set(Math.random() > 0.5 ? 9 : -9);
      animate(kick, 0, { type: "spring", stiffness: 300, damping: 9 });
    };
    document.addEventListener("input", onKey);
    return () => document.removeEventListener("input", onKey);
  }, [kick, reduce]);

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden"
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(0.5 - (e.clientX - r.left) / r.width);
        my.set(0.5 - (e.clientY - r.top) / r.height);
      }}
    >
      {OBJECTS.map((o, i) => (
        <Floater key={o.src} o={o} px={px} py={py} kick={kick} i={i} />
      ))}
      <div className="relative z-10 max-w-[420px] px-6 text-center">
        <p className="text-[44px] leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-ink">
          Put your hours where your goals are.
        </p>
        <p className="mx-auto mt-4 max-w-[320px] text-[16px] leading-relaxed text-ink-2">
          Pick a few goals. Timeo books the time and keeps you on it.
        </p>
      </div>
      <div className="absolute right-10 bottom-10">
        <Timi size={64} interactive />
      </div>
    </div>
  );
}
