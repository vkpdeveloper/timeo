import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { WEEKDAY_LETTER, dayOfMonth } from "@/lib/dates";
import type { DayStatus, TrainingDay } from "@/lib/fitness";
import type { MacroTotals } from "@/lib/fitness-math";
import { Bar } from "./charts";

// Server-safe building blocks used across the Fitness screens.

const CHIP: Record<string, { label: string; cls: string }> = {
  completed: { label: "Done", cls: "bg-ok-soft text-ok" },
  in_progress: { label: "In progress", cls: "bg-accent-soft text-accent" },
  skipped: { label: "Skipped", cls: "bg-sunken text-ink-2" },
  unlogged: { label: "Done, not logged", cls: "bg-warn-soft text-warn" },
  planned: { label: "Planned", cls: "bg-sunken text-ink-2" },
  rest: { label: "Rest", cls: "bg-sunken text-ink-3" },
  unreported: { label: "No record", cls: "bg-sunken text-ink-3" },
};

export function StatusChip({ status, className }: { status: DayStatus; className?: string }) {
  const c = CHIP[status];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium", c.cls, className)}>
      {c.label}
    </span>
  );
}

/** Mon–Sun strip with plan vs actual per day. Compact: letter, state, name. */
export function WeekStrip({ days, href }: { days: TrainingDay[]; href?: (d: TrainingDay) => string | null }) {
  return (
    <div className="stagger grid grid-cols-7 gap-0.5">
      {days.map((d) => {
        const link = href?.(d) ?? null;
        const inner = (
          <>
            <span className={cn("text-[11.5px]", d.isToday ? "font-semibold text-ink" : "font-medium text-ink-3")}>
              {WEEKDAY_LETTER[d.weekday]}
            </span>
            <DayDot day={d} />
            <span
              className={cn(
                "w-full truncate px-0.5 text-center text-[11px] leading-tight",
                d.status === "rest" || d.status === "unreported" ? "text-ink-3" : "text-ink-2",
              )}
            >
              {shortName(d)}
            </span>
          </>
        );
        const cls = cn(
          "flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[12px] py-2",
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
  const base = "relative grid size-8 place-items-center rounded-full text-[12.5px] font-medium tnum";
  switch (d.status) {
    case "completed":
      return (
        <span className={cn(base, "text-accent-ink")} style={{ background: c }}>
          <Check className="size-4" strokeWidth={2.8} />
          {d.swapped && <SwapMark />}
        </span>
      );
    case "unlogged":
      return (
        <span className={cn(base, "border-[1.5px] border-dashed")} style={{ borderColor: c, color: c, background: softVar(d.color) }}>
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
        <span className={cn(base, "border-[1.5px] border-line-strong text-ink-3")}>
          <X className="size-3.5" strokeWidth={2.4} />
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
          className={cn(base, "border-[1.5px]")}
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

type Macro = { key: string; label: string; unit: string; value: number; target: number | null; color: string };

function macros(totals: MacroTotals, target: MacroTotals | null): Macro[] {
  return [
    { key: "kcal", label: "kcal", unit: "", value: totals.calories, target: target?.calories ?? null, color: "var(--accent)" },
    { key: "p", label: "Protein", unit: "g", value: totals.proteinG, target: target?.proteinG ?? null, color: "var(--c-teal)" },
    { key: "c", label: "Carbs", unit: "g", value: totals.carbsG, target: target?.carbsG ?? null, color: "var(--c-sky)" },
    { key: "f", label: "Fat", unit: "g", value: totals.fatG, target: target?.fatG ?? null, color: "var(--c-sand)" },
  ];
}

/** Protein, carbs and fat as labelled meters with what is left. For the nutrition screen. */
export function MacroMeters({ totals, target }: { totals: MacroTotals; target: MacroTotals | null }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {macros(totals, target)
        .slice(1)
        .map((m, i) => {
          const left = m.target != null ? m.target - m.value : null;
          return (
            <div key={m.key} className="min-w-0">
              <div className="text-[12.5px] font-medium text-ink-3">{m.label}</div>
              <div className="tnum mt-0.5 truncate text-[16px] font-semibold tracking-tight text-ink">
                {m.value}
                <span className="text-[12.5px] font-medium text-ink-3">{m.target != null ? ` / ${m.target} g` : " g"}</span>
              </div>
              <Bar value={m.target ? m.value / m.target : 0} color={m.color} className="mt-1.5" delay={0.1 + i * 0.06} />
              {left != null && (
                <div className={cn("tnum mt-1 text-[12px]", left < 0 ? "text-warn" : "text-ink-3")}>
                  {left >= 0 ? `${left} g left` : `${-left} g over`}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
