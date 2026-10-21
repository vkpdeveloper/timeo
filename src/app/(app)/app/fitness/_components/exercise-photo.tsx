"use client";

import { Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { exerciseImage } from "@/lib/exercise-catalog";

/** Small square photo of a library exercise; a quiet icon when there's none. */
export function ExerciseThumb({ catalogId, size = 44, className }: { catalogId?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken", className)} style={{ width: size, height: size }}>
      {catalogId && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized webp from R2, no optimiser needed
        <img src={exerciseImage(catalogId)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <Dumbbell className="size-[45%] text-ink-3" strokeWidth={1.8} />
      )}
    </span>
  );
}

/** The start and end photos, alternating like a two-frame loop. Tap to hold a frame. */
export function ExerciseFrames({ catalogId, name, images, className }: { catalogId: string; name: string; images: number; className?: string }) {
  const [frame, setFrame] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (images < 2 || held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => 1 - f), 1400);
    return () => clearInterval(id);
  }, [images, held]);

  if (!images) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setHeld(true);
        setFrame((f) => (images > 1 ? 1 - f : f));
      }}
      aria-label={`${name}, ${frame ? "end" : "start"} position. Tap to switch.`}
      className={cn("relative block aspect-[3/2] w-full overflow-hidden rounded-[16px] bg-sunken", className)}
    >
      {Array.from({ length: images }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized webp from R2, no optimiser needed
        <img
          key={i}
          src={exerciseImage(catalogId, i)}
          alt=""
          decoding="async"
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-500", frame === i ? "opacity-100" : "opacity-0")}
        />
      ))}
      {images > 1 && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2">
          {frame ? "End" : "Start"}
        </span>
      )}
    </button>
  );
}
