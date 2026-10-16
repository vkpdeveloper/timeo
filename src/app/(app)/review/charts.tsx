import { colorVar } from "@/lib/colors";
import { formatDuration, formatWeekdayShort, WEEKDAY_LETTER } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { EnergyRow } from "./data";

/** Focus minutes per day, Monday to Sunday, today highlighted. */
export function FocusWeekChart({ days, today }: { days: { date: string; focusMin: number }[]; today: string }) {
  const W = 320;
  const H = 128;
  const top = 18;
  const base = H - 22;
  const max = Math.max(60, ...days.map((d) => d.focusMin));
  // round the scale up to a whole hour so the guide line reads cleanly
  const scaleMax = Math.ceil(max / 60) * 60;
  const slot = W / 7;
  const barW = 22;
  const r = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Focus minutes per day this week">
      <line x1={0} x2={W} y1={top} y2={top} stroke="var(--line-strong)" strokeDasharray="2 4" />
      <text x={W} y={top - 6} textAnchor="end" className="fill-ink-3 text-[10px] font-medium">
        {formatDuration(scaleMax)}
      </text>
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line)" />
      {days.map((d, i) => {
        const isToday = d.date === today;
        const future = d.date > today;
        const h = d.focusMin > 0 ? Math.max(r * 2, ((base - top) * d.focusMin) / scaleMax) : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = base - h;
        return (
          <g key={d.date}>
            <title>{`${formatWeekdayShort(d.date)}: ${d.focusMin ? formatDuration(d.focusMin) : "no focus"}`}</title>
            {/* generous hit target for the tooltip */}
            <rect x={i * slot} y={top} width={slot} height={base - top} fill="transparent" />
            {h > 0 ? (
              <path
                d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z`}
                fill={isToday ? "var(--accent)" : "color-mix(in oklab, var(--ink) 20%, var(--surface))"}
              />
            ) : (
              <rect
                x={x}
                y={base - 3}
                width={barW}
                height={3}
                rx={1.5}
                fill={future ? "var(--sunken)" : "var(--line-strong)"}
              />
            )}
            {isToday && d.focusMin > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="tnum fill-ink text-[10px] font-semibold">
                {formatDuration(d.focusMin)}
              </text>
            )}
            <text
              x={i * slot + slot / 2}
              y={H - 4}
              textAnchor="middle"
              className={cn("text-[11px]", isToday ? "fill-ink font-bold" : "fill-ink-3 font-medium")}
            >
              {WEEKDAY_LETTER[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const GAVE = "var(--c-teal)";
const DRAINED = "var(--c-rose)";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

/** Diverging bars: average energy after sessions, -2 (drained) to +2 (energised). */
export function EnergyBars({ rows }: { rows: EnergyRow[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const pct = (Math.min(2, Math.abs(row.avg)) / 2) * 50;
        const positive = row.avg >= 0;
        return (
          <li key={row.key} title={`${row.sessions} sessions · ${formatDuration(row.minutes)}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink">
                {row.color && <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(row.color) }} />}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="tnum shrink-0 text-[12.5px] text-ink-3">
                {formatDuration(row.minutes)} ·{" "}
                <span className="font-semibold text-ink-2">{signed(row.avg)}</span>
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-sunken">
              <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-line-strong" />
              {pct > 0 && (
                <span
                  className={cn("absolute inset-y-0", positive ? "left-1/2 rounded-r-full" : "right-1/2 rounded-l-full")}
                  style={{ width: `${pct}%`, background: positive ? GAVE : DRAINED }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EnergyLegend() {
  return (
    <div className="flex justify-between text-[11.5px] font-medium text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: DRAINED }} />
        Drained
      </span>
      <span className="inline-flex items-center gap-1.5">
        Gave energy
        <span className="size-2 rounded-full" style={{ background: GAVE }} />
      </span>
    </div>
  );
}
