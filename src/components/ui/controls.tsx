"use client";

import { Check, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_COLOR, PALETTE, colorVar, resolveColor } from "@/lib/colors";
import { springs } from "./motion";

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="text-[12px] font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn("field", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("field", className)} {...props} />;
}

/** Segmented control. Works inside forms via a hidden input when `name` is set. */
export function Segmented<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  name,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value?: T;
  defaultValue?: T;
  onChange?: (v: T) => void;
  name?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [inner, setInner] = useState<T>(defaultValue ?? options[0].value);
  const current = value ?? inner;
  const layoutId = useId();
  return (
    <div className={cn("relative flex rounded-[12px] bg-sunken p-[3px]", className)}>
      {name && <input type="hidden" name={name} value={current} />}
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setInner(o.value);
              onChange?.(o.value);
            }}
            className={cn(
              "relative z-10 flex-1 rounded-[9px] font-medium transition-colors",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-[14px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-[9px] border border-line bg-surface"
                transition={springs.snappy}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Wrapping pill selector (single choice). */
export function PillPicker<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  name,
  className,
}: {
  options: { value: T; label: ReactNode; color?: string }[];
  value?: T;
  defaultValue?: T;
  onChange?: (v: T) => void;
  name?: string;
  className?: string;
}) {
  const [inner, setInner] = useState<T | undefined>(defaultValue);
  const current = value ?? inner;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {name && <input type="hidden" name={name} value={current ?? ""} />}
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setInner(o.value);
              onChange?.(o.value);
            }}
            className={cn(
              "tap inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium",
              active ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink-2",
            )}
          >
            {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The 7 goal colours. A legacy stored key (e.g. "violet") shows as, and saves as, its new colour. */
export function ColorPicker({ name, defaultValue = DEFAULT_COLOR }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState<string>(resolveColor(defaultValue));
  return (
    <div className="flex flex-wrap gap-2.5">
      <input type="hidden" name={name} value={value} />
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => setValue(c)}
          className="tap grid size-9 place-items-center rounded-full"
          style={{ background: colorVar(c) }}
        >
          {value === c && <Check className="size-4 text-accent-ink" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

/** Number stepper with large touch targets. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  format,
  name,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => ReactNode;
  name?: string;
  className?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-[12px] bg-sunken p-1", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="tap grid size-11 place-items-center rounded-[9px] border border-line bg-surface text-ink"
        aria-label="Decrease"
      >
        <Minus className="size-4" strokeWidth={2.4} />
      </button>
      <div className="tnum min-w-12 text-center text-[17px] font-semibold text-ink">{format ? format(value) : value}</div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="tap grid size-11 place-items-center rounded-[9px] border border-line bg-surface text-ink"
        aria-label="Increase"
      >
        <Plus className="size-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Round check button. */
export function CheckCircle({
  checked,
  onToggle,
  color = "var(--tint)",
  size = 24,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle?: () => void;
  color?: string;
  size?: number;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Mark as not done" : "Mark as done")}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!checked && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        onToggle?.();
      }}
      className="tap relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size + 12, height: size + 12, margin: -6 }}
    >
      <motion.span
        className="grid place-items-center rounded-full border-[1.75px]"
        style={{ width: size, height: size }}
        initial={false}
        animate={{
          backgroundColor: checked ? color : "rgba(0,0,0,0)",
          borderColor: checked ? color : "var(--line-strong)",
          scale: checked ? [1, 1.15, 1] : 1,
        }}
        transition={{ duration: 0.28 }}
      >
        <motion.span initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.5 }} transition={{ duration: 0.18 }}>
          <Check className="text-accent-ink" style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={3.2} />
        </motion.span>
      </motion.span>
    </button>
  );
}

/** On/off switch for a setting. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("tap relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-ok" : "bg-line-strong")}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
