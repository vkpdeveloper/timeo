"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useSyncExternalStore } from "react";
import { Timi } from "@/components/ai/timi";
import { useNow } from "@/components/ui/live";
import { cn } from "@/lib/cn";

type Phase = "dawn" | "day" | "dusk" | "night";
const PHASES: Phase[] = ["dawn", "day", "dusk", "night"];

function phaseAt(hour: number): Phase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

const GREETING: Record<Phase, string> = {
  dawn: "Early start.",
  day: "The day is open.",
  dusk: "Winding down.",
  night: "Late one.",
};

const noop = () => () => {};
function readHourParam(): number | null {
  const h = new URLSearchParams(window.location.search).get("hour");
  return h !== null && !Number.isNaN(Number(h)) ? Number(h) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_END = 22 * 60;

/**
 * A desk by a window whose sky matches your clock: dawn, day, dusk or night.
 * The scene leans a little with the pointer. `?hour=19` previews another time.
 */
export function DaylightLook() {
  const now = useNow();
  const override = useSyncExternalStore(noop, readHourParam, () => null);

  const d = now ? new Date(now) : null;
  const hour = override ?? d?.getHours() ?? 12;
  const minute = override !== null ? 0 : (d?.getMinutes() ?? 0);
  const phase = phaseAt(hour);
  const left = Math.max(0, DAY_END - (hour * 60 + minute));

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const x = useTransform(sx, (v) => v * -14);
  const y = useTransform(sy, (v) => v * -10);

  return (
    <div
      className="relative flex w-full overflow-hidden"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
    >
      <motion.div className="absolute -inset-6" style={{ x, y }}>
        {PHASES.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p}
            src={`/auth/daylight-${p}.webp`}
            alt=""
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-[1400ms]",
              p === phase ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </motion.div>

      <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-12">
        <div
          className={cn(
            "w-fit max-w-[340px] rounded-[18px] bg-bg/90 px-6 py-5 transition-opacity duration-500",
            now ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">
            {pad(hour)}:{pad(minute)}
          </div>
          <p className="mt-4 text-[20px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">{GREETING[phase]}</p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">
            {hour < 5
              ? "Past midnight. Tomorrow is already planned."
              : left > 0
                ? `${Math.floor(left / 60)}h ${left % 60}m of today left to plan.`
                : "Today is done. Tomorrow is ready."}
          </p>
        </div>
        <div className="flex justify-end pr-[6%] pb-[2%]">
          <Timi size={88} interactive mood={phase === "night" ? "sleepy" : "idle"} />
        </div>
      </div>
    </div>
  );
}
