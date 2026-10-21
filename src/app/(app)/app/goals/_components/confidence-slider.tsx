"use client";

import { cn } from "@/lib/cn";

/**
 * 0–100% in steps of 5. A flat track with a solid fill in the local --tint and
 * a surface thumb; the native range input sits on top for touch and keyboard.
 */
export function ConfidenceSlider({
  value,
  onChange,
  name,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  name?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative h-11", className)}>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-tint transition-[width] duration-150" style={{ width: `${value}%` }} />
      </div>
      <input
        type="range"
        name={name}
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Confidence"
        aria-valuetext={`${value}%`}
        className={cn(
          "absolute inset-0 h-11 w-full cursor-pointer appearance-none bg-transparent",
          "[&::-webkit-slider-runnable-track]:h-11 [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:mt-2 [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-tint [&::-webkit-slider-thumb]:bg-surface",
          "[&::-moz-range-track]:bg-transparent",
          "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-tint [&::-moz-range-thumb]:bg-surface",
          "focus-visible:outline-none [&:focus-visible::-webkit-slider-thumb]:ring-4 [&:focus-visible::-webkit-slider-thumb]:ring-accent-soft",
        )}
      />
    </div>
  );
}
