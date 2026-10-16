import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProgressBar, ProgressRing } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { WEEKDAY_LETTER, dayOfMonth } from "@/lib/dates";
import type { DayStatus, TrainingDay } from "@/lib/fitness";
import { fmtCompact, type MacroTotals } from "@/lib/fitness-math";

// Server-safe building blocks used across the Fitness screens.

const CHIP: Record<string, { label: string; cls: string }> = {
  completed: { label: "Done", cls: "bg-ok-soft text-ok" },
  in_progress: { label: "In progress", cls: "bg-accent-soft text-accent" },
  skipped: { label: "Skipped", cls: "bg-bad-soft text-bad" },
  unlogged: { label: "Done, not logged", cls: "bg-warn-soft text-warn" },
  planned: { label: "Planned", cls: "bg-sunken text-ink-2" },
  rest: { label: "Rest", cls: "bg-sunken text-ink-3" },
  unreported: { label: "No record", cls: "bg-sunken text-ink-3" },
};

export function StatusChip({ status, className }: { status: DayStatus; className?: string }) {
  const c = CHIP[status];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-semibold", c.cls, className)}>
      {c.label}
    </span>
  );
}

/** Mon–Sun strip with plan vs actual per day. */
export function WeekStrip({ days, href }: { days: TrainingDay[]; href?: (d: TrainingDay) => string | null }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const link = href?.(d) ?? null;
        const inner = (
          <>
            <span className={cn("text-[11px] font-semibold", d.isToday ? "text-ink" : "text-ink-3")}>
              {WEEKDAY_LETTER[d.weekday]}
            </span>
            <DayDot day={d} />
            <span
              className={cn(
                "w-full truncate text-center text-[10.5px] font-medium leading-tight",
                d.status === "rest" || d.status === "unreported" ? "text-ink-3" : "text-ink-2",
              )}
            >
              {shortName(d)}
            </span>
          </>
        );
        const cls = cn(
          "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl py-2",
          d.isToday && "bg-sunken",
          link && "tap",
        );
        return link ? (
          <Link key={d.date} href={link} className={cls} aria-label={`${d.date}: ${CHIP[d.status].label}`}>
            {inner}
          </Link>
        ) : (
          <div key={d.date} className={cls} aria-label={`${d.date}: ${CHIP[d.status].label}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function shortName(d: TrainingDay) {
  if (d.log && d.log.status !== "skipped") return d.log.name;
  if (d.status === "rest") return "Rest";
  return d.scheduled.routine?.name ?? "Rest";
}

function DayDot({ day: d }: { day: TrainingDay }) {
  const c = colorVar(d.color);
  const base = "relative grid size-9 place-items-center rounded-full text-[13px] font-semibold tnum";
  switch (d.status) {
    case "completed":
      return (
        <span className={base} style={{ background: c, color: "white" }}>
          <Check className="size-4" strokeWidth={3} />
          {d.swapped && <SwapMark />}
        </span>
      );
    case "unlogged":
      return (
        <span className={cn(base, "border-[1.75px] border-dashed")} style={{ borderColor: c, color: c, background: softVar(d.color) }}>
          <Check className="size-4" strokeWidth={2.6} />
          {d.swapped && <SwapMark />}
        </span>
      );
    case "in_progress":
      return (
        <span className={cn(base, "border-2")} style={{ borderColor: c, color: c }}>
          <span className="size-2 animate-pulse rounded-full" style={{ background: c }} />
        </span>
      );
    case "skipped":
      return (
        <span className={cn(base, "bg-bad-soft text-bad")}>
          <X className="size-4" strokeWidth={2.6} />
        </span>
      );
    case "rest":
      return (
        <span className={cn(base, "text-ink-3")}>
          <Minus className="size-3.5" strokeWidth={2.4} />
        </span>
      );
    case "unreported":
      return <span className={cn(base, "border-[1.5px] border-dashed border-line-strong text-ink-3")}>{dayOfMonth(d.date)}</span>;
    default:
      return (
        <span
          className={cn(base, "border-[1.75px]")}
          style={{ borderColor: d.isToday ? c : `color-mix(in oklab, ${c} 45%, transparent)`, color: d.isToday ? c : "var(--ink-2)" }}
        >
          {dayOfMonth(d.date)}
        </span>
      );
  }
}

function SwapMark() {
  return (
    <span
      className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full border-2 border-surface bg-ink"
      aria-label="Swapped session"
    />
  );
}

/** Ring for calories and three thin bars for macros. */
export function MacroSummary({
  totals,
  target,
  compact,
}: {
  totals: MacroTotals;
  target: MacroTotals | null;
  compact?: boolean;
}) {
  const ringSize = compact ? 92 : 112;
  const left = target ? target.calories - totals.calories : null;
  return (
    <div className="flex items-center gap-5">
      <ProgressRing
        value={target ? totals.calories / Math.max(1, target.calories) : 0}
        size={ringSize}
        stroke={compact ? 8 : 9}
        color={left != null && left < 0 ? "var(--warn)" : "var(--c-amber)"}
      >
        <div className="text-center leading-none">
          <div className={cn("tnum font-semibold tracking-tight text-ink", compact ? "text-[20px]" : "text-[24px]")}>
            {fmtCompact(totals.calories)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-ink-3">
            {target ? `of ${fmtCompact(target.calories)}` : "kcal"}
          </div>
        </div>
      </ProgressRing>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <MacroBar label="Protein" value={totals.proteinG} target={target?.proteinG} color="var(--c-rose)" />
        <MacroBar label="Carbs" value={totals.carbsG} target={target?.carbsG} color="var(--c-sky)" />
        <MacroBar label="Fat" value={totals.fatG} target={target?.fatG} color="var(--c-teal)" />
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target?: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tnum text-ink-3">
          <span className="font-semibold text-ink">{value}</span>
          {target ? ` / ${target} g` : " g"}
        </span>
      </div>
      <ProgressBar value={target ? value / target : 0} color={color} />
    </div>
  );
}

/** Tiny trend line; values are plotted evenly spaced. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "var(--c-sage)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

export function StatTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-[22px] font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function IconBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]"
      style={{ background: `color-mix(in oklab, ${color} 14%, var(--surface))`, color }}
    >
      {children}
    </span>
  );
}
