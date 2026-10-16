"use client";

import { Check, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PALETTE, colorVar } from "@/lib/colors";

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
    <div className={cn("relative flex rounded-[14px] bg-sunken p-1", className)}>
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
              "relative z-10 flex-1 rounded-[10px] font-semibold transition-colors",
              size === "sm" ? "h-8 text-[12.5px]" : "h-9 text-[13.5px]",
              active ? "text-ink" : "text-ink-3",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-[10px] bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
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
              "tap inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium",
              active ? "border-ink bg-ink text-bg" : "border-line bg-surface-2 text-ink-2",
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

export function ColorPicker({ name, defaultValue = "coral" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-wrap gap-2.5">
      <input type="hidden" name={name} value={value} />
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => setValue(c)}
          className="tap grid size-9 place-items-center rounded-full"
          style={{ background: colorVar(c) }}
        >
          {value === c && <Check className="size-4 text-white" strokeWidth={3} />}
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
    <div className={cn("flex items-center justify-between gap-2 rounded-2xl bg-sunken p-1", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="tap grid size-10 place-items-center rounded-xl bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
        aria-label="Decrease"
      >
        <Minus className="size-4" strokeWidth={2.4} />
      </button>
      <div className="tnum min-w-12 text-center text-[17px] font-semibold text-ink">{format ? format(value) : value}</div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="tap grid size-10 place-items-center rounded-xl bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
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
          <Check className="text-white" style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={3.2} />
        </motion.span>
      </motion.span>
    </button>
  );
}
