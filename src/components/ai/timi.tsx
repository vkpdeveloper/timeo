"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

// Two 3x3 sprite sheets (built with the page-mascot skill, sources in characters/timi).
const DIRECTIONS_SRC = "/mascots/timi-directions.webp";
const REACTIONS_SRC = "/mascots/timi-reactions.webp";

const DIRECTIONS = ["up-left", "up", "up-right", "left", "center", "right", "down-left", "down", "down-right"] as const;
const REACTIONS = ["blink", "heart", "sparkle", "surprised", "wink", "bashful", "sleepy", "dizzy", "delighted"] as const;

type Direction = (typeof DIRECTIONS)[number];
type Reaction = (typeof REACTIONS)[number];

/**
 * What Timi is up to.
 * idle: looks at you and blinks now and then · thinking: glances around while a run works ·
 * happy: just finished something · error: dizzy · sleepy: nothing to do.
 */
export type TimiMood = "idle" | "thinking" | "happy" | "error" | "sleepy";

const MOOD_FACE: Partial<Record<TimiMood, Reaction>> = { happy: "delighted", error: "dizzy", sleepy: "sleepy" };
const THINKING: Direction[] = ["up-right", "up", "up-left", "up"];

// Pointer tracking (clockwise from the right, matching atan2 with y pointing down).
const CLOCKWISE: Direction[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];
const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE = 70;

const PAYOFFS: Reaction[] = ["heart", "sparkle", "delighted", "bashful", "wink"];
const SQUASH: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

// The cells have wide margins; zoom in so Timi fills the box. Small sizes crop to the face,
// large ones keep room above the antenna for hearts and Zzz.
const FRAME = { small: { zoom: 1.5, y: 0.4 }, large: { zoom: 1.3, y: 0.42 } };

function cellStyle(index: number, size: number): CSSProperties {
  const { zoom, y } = size < 48 ? FRAME.small : FRAME.large;
  const cell = size * zoom;
  const left = ((index % 3) + 0.5) * cell - size / 2;
  const top = (Math.floor(index / 3) + y) * cell - size / 2;
  return { backgroundSize: `${cell * 3}px ${cell * 3}px`, backgroundPosition: `${-left}px ${-top}px` };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  mood?: TimiMood;
  size?: number;
  /** Follow the pointer and react when booped. */
  interactive?: boolean;
  className?: string;
};

/** Timi, the little robot. Swaps cells of two sprite sheets, no per-frame work. */
export function Timi({ mood = "idle", size = 24, interactive = false, className }: Props) {
  const [look, setLook] = useState<Direction>("center");
  const [glance, setGlance] = useState(0);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const squashRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const boops = useRef({ count: 0, at: 0 });

  // thinking: glance around
  useEffect(() => {
    if (mood !== "thinking" || reducedMotion()) return;
    const id = window.setInterval(() => setGlance((g) => g + 1), 700);
    return () => window.clearInterval(id);
  }, [mood]);

  // idle: blink every few seconds
  useEffect(() => {
    if (mood !== "idle" || reducedMotion()) return;
    let id = 0;
    const next = () => {
      id = window.setTimeout(() => {
        setReaction((r) => r ?? "blink");
        id = window.setTimeout(() => {
          setReaction((r) => (r === "blink" ? null : r));
          next();
        }, 140);
      }, 2800 + Math.random() * 3200);
    };
    next();
    return () => window.clearTimeout(id);
  }, [mood]);

  // follow the pointer on devices that have one
  useEffect(() => {
    if (!interactive || mood !== "idle" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let sector = -1;
    let pointer: { x: number; y: number } | null = null;
    const aim = () => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || !pointer) return;
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      if (Math.hypot(dx, dy) < DEAD_ZONE) {
        sector = -1;
        return setLook("center");
      }
      // hold the current sector until the pointer is well past its edge
      const angle = Math.atan2(dy, dx);
      const off = angle - sector * SECTOR;
      if (sector !== -1 && Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < SECTOR / 2 + HYSTERESIS) return;
      sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
      setLook(CLOCKWISE[sector]);
    };
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      aim();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", aim, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", aim);
    };
  }, [interactive, mood]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function boop() {
    timers.current.forEach(window.clearTimeout);
    const later = (ms: number, r: Reaction | null) => timers.current.push(window.setTimeout(() => setReaction(r), ms));
    const now = Date.now();
    const b = boops.current;
    b.count = now - b.at < 1600 ? b.count + 1 : 1;
    b.at = now;
    if (b.count >= 4) {
      b.count = 0;
      setReaction("dizzy");
      later(1100, null);
    } else {
      setReaction("blink");
      later(120, PAYOFFS[Math.floor(Math.random() * PAYOFFS.length)]);
      later(700, null);
    }
    if (!reducedMotion()) squashRef.current?.animate(SQUASH, { duration: 420, easing: "linear" });
  }

  const direction = mood === "thinking" ? THINKING[glance % THINKING.length] : look;
  const face = reaction ?? MOOD_FACE[mood] ?? null;
  const layer = "absolute inset-0 bg-no-repeat";
  const body = (
    <span ref={squashRef} className="relative block size-full origin-[50%_78%]">
      <span
        className={cn(layer, face && "opacity-0")}
        style={{ backgroundImage: `url(${DIRECTIONS_SRC})`, ...cellStyle(DIRECTIONS.indexOf(direction), size) }}
      />
      {/* always mounted so the sheet loads up front */}
      <span
        className={cn(layer, !face && "opacity-0")}
        style={{ backgroundImage: `url(${REACTIONS_SRC})`, ...cellStyle(REACTIONS.indexOf(face ?? "blink"), size) }}
      />
    </span>
  );

  if (interactive)
    return (
      <button
        type="button"
        onClick={boop}
        aria-label="Boop Timi"
        className={cn("relative block shrink-0 cursor-pointer select-none", className)}
        style={{ width: size, height: size }}
      >
        <span ref={boxRef} className="block size-full">
          {body}
        </span>
      </button>
    );

  return (
    <span aria-hidden className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {body}
    </span>
  );
}
