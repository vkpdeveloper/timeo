import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { AskTimi } from "./ask-timi";

export { AskTimi };

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

/** A hairline card whose direct children are divided rows. */
export function CardList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card card-list overflow-hidden", className)} {...props} />;
}

/**
 * The base building block of every page: a compact title row (title, count,
 * action), an optional hint line, then content. With `card`, children sit in
 * one hairline card and direct children get dividers (use `Row`s).
 */
export function Section({
  title,
  count,
  hint,
  action,
  card = false,
  stagger = false,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  /** Small ink-3 number or note next to the title, e.g. 4 or "2 left". */
  count?: ReactNode;
  /** One plain line under the title. */
  hint?: ReactNode;
  /** Right side of the title row, usually a SectionLink or a small ghost button. */
  action?: ReactNode;
  /** Wrap children in one hairline card with divided rows. */
  card?: boolean;
  /** Children rise in one after another. */
  stagger?: boolean;
  children: ReactNode;
  className?: string;
  /** Classes for the card (with `card`) or the content wrapper. */
  bodyClassName?: string;
  id?: string;
}) {
  const head = title || action || count != null;
  return (
    <section id={id} className={cn("mt-6 first:mt-0", className)}>
      {head && (
        <div className={cn("flex min-h-7 items-center justify-between gap-3 px-1", hint ? "mb-0.5" : "mb-2")}>
          <h2 className="flex min-w-0 items-baseline gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
            {title && <span className="truncate">{title}</span>}
            {count != null && <span className="tnum shrink-0 text-[13px] font-medium text-ink-3">{count}</span>}
          </h2>
          {action && <div className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-3">{action}</div>}
        </div>
      )}
      {hint && <p className={cn("px-1 text-[13px] leading-snug text-ink-3", head ? "mb-2.5" : "mb-2")}>{hint}</p>}
      {card ? (
        <div className={cn("card card-list overflow-hidden", stagger && "stagger", bodyClassName)}>{children}</div>
      ) : stagger || bodyClassName ? (
        <div className={cn(stagger && "stagger", bodyClassName)}>{children}</div>
      ) : (
        children
      )}
    </section>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="tap -my-2 -mr-1 inline-flex h-10 items-center gap-0.5 rounded-full px-1 text-[13px] font-medium text-ink-3 hover:text-ink"
    >
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

/** Compact, iOS-style large title. One per top-level page. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  /** Small uppercase line above the title (date, season week). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One plain line under the title. */
  subtitle?: ReactNode;
  /** Right side, bottom-aligned with the title. Keep it to one quiet control. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4 pt-5 pb-4 lg:pt-10 lg:pb-5", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="display text-[32px] text-balance text-ink lg:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 pb-0.5">{action}</div>}
    </header>
  );
}

/** Pushed screen header with a back link. */
export function SubHeader({
  back,
  backLabel = "Back",
  title,
  action,
}: {
  back: string;
  backLabel?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 glass px-4 pt-safe sm:-mx-6 sm:px-6">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Link
          href={back}
          className="tap -ml-1.5 inline-flex h-11 items-center gap-0.5 justify-self-start rounded-full px-1.5 text-[15px] font-medium text-accent"
        >
          <ChevronRight className="size-5 rotate-180" strokeWidth={2.2} />
          <span className="truncate">{backLabel}</span>
        </Link>
        <div className="min-w-0 truncate text-center text-[15px] font-semibold text-ink">{title}</div>
        <div className="flex min-w-14 items-center justify-end justify-self-end">{action}</div>
      </div>
    </div>
  );
}

/**
 * Says exactly what to do and offers the button. `timi` adds an Ask Timi
 * chip with that prompt. `bare` drops the card (inside a Section card).
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  timi,
  timiLabel,
  bare = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  /** Prompt for an Ask Timi chip. */
  timi?: string;
  timiLabel?: string;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rise flex flex-col items-center px-6 py-8 text-center", !bare && "card", className)}>
      {icon && (
        <div className="mb-3 grid size-10 place-items-center rounded-[14px] bg-sunken text-ink-2 [&_svg]:size-[18px]">{icon}</div>
      )}
      <div className="text-[15px] font-semibold tracking-tight text-ink">{title}</div>
      {body && <p className="mt-1 max-w-[32ch] text-[13.5px] leading-relaxed text-ink-3">{body}</p>}
      {(action || timi) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {timi && <AskTimi prompt={timi} label={timiLabel} />}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 5,
  color = "var(--tint)",
  track = "var(--sunken)",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  color = "var(--tint)",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}>
      <div
        className="h-full rounded-full"
        style={{ width: `${v * 100}%`, background: color, transition: "width 600ms cubic-bezier(0.32,0.72,0,1)" }}
      />
    </div>
  );
}

const STATUS = {
  on_track: { label: "On track", cls: "bg-ok-soft text-ok", dot: "bg-ok" },
  adjust: { label: "Adjust", cls: "bg-warn-soft text-warn", dot: "bg-warn" },
  off_track: { label: "Off track", cls: "bg-bad-soft text-bad", dot: "bg-bad" },
} as const;

export type Status = keyof typeof STATUS;

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold", s.cls, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export const statusLabel = (s: Status) => STATUS[s].label;

export function Chip({ children, className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-medium text-ink-2", className)}
      {...props}
    >
      {children}
    </span>
  );
}

type RowTone = "default" | "accent" | "ok" | "warn" | "bad";

const TONE_TEXT: Record<RowTone, string> = {
  default: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

/** 32px rounded tile for a row's leading icon. `color` is a palette name (src/lib/colors.ts). */
export function RowIcon({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[17px]",
        !color && "bg-sunken text-ink-2",
        className,
      )}
      style={color ? { background: softVar(color), color: colorVar(color) } : undefined}
    >
      {children}
    </span>
  );
}

/**
 * A ~52px list row. Put several in `<Section card>` or `<CardList>`; they divide
 * themselves. Either pass `title`/`subtitle`/`value`, or free-form children.
 * `href` renders a Link, `onClick` a button (client parents only).
 */
export function Row({
  href,
  onClick,
  icon,
  iconColor,
  title,
  subtitle,
  value,
  tone = "default",
  children,
  className,
  chevron,
}: {
  href?: string;
  onClick?: () => void;
  /** Leading slot. An svg icon gets a RowIcon tile; any other node renders as is. */
  icon?: ReactNode;
  /** Palette colour for the icon tile. */
  iconColor?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Trailing text (ink-3, tnum). */
  value?: ReactNode;
  /** Colour of the title. */
  tone?: RowTone;
  children?: ReactNode;
  className?: string;
  /** Defaults to true when the row is tappable. */
  chevron?: boolean;
}) {
  const tappable = Boolean(href || onClick);
  const showChevron = chevron ?? tappable;
  const inner = (
    <>
      {icon && (isValidElement(icon) && icon.type === RowIcon ? icon : <RowIcon color={iconColor}>{icon}</RowIcon>)}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {(title || subtitle) && (
          <div className="min-w-0 flex-1">
            {title && <div className={cn("truncate text-[15px] font-medium", TONE_TEXT[tone])}>{title}</div>}
            {subtitle && <div className="truncate text-[13px] text-ink-3">{subtitle}</div>}
          </div>
        )}
        {children}
      </div>
      {value != null && <div className="tnum max-w-[45%] shrink-0 truncate text-right text-[14px] text-ink-3">{value}</div>}
      {showChevron && <ChevronRight className="-mr-1 size-4 shrink-0 text-ink-3" />}
    </>
  );
  const cls = cn(
    "flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line",
    tappable && "tap-row",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

const STAT_TONE: Record<RowTone | "muted", string> = { ...TONE_TEXT, muted: "text-ink-3" };

/**
 * One plain number with a label: "3h 40m" / "free before 10 pm".
 * Value first, label under it. Pass a CountUp as `value` for hero numbers.
 */
export function Stat({
  label,
  value,
  unit,
  sub,
  tone = "default",
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Small unit after the value ("kg", "of 6h"). */
  unit?: ReactNode;
  /** Extra quiet line under the label. */
  sub?: ReactNode;
  tone?: RowTone | "muted";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline gap-1">
        <span className={cn("tnum truncate text-[20px] leading-tight font-semibold tracking-tight", STAT_TONE[tone])}>{value}</span>
        {unit && <span className="shrink-0 text-[12.5px] font-medium text-ink-3">{unit}</span>}
      </div>
      <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug font-medium text-ink-3">{label}</div>
      {sub && <div className="truncate text-[12px] text-ink-3">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className={cn("tap block min-w-0", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn("min-w-0", className)}>{body}</div>
  );
}

/**
 * The certainty strip: 2–4 Stats in a row, split by hairlines. Sits right
 * under the PageHeader. `card` puts it in a hairline card.
 */
export function StatStrip({ children, card = false, className }: { children: ReactNode; card?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "stagger grid auto-cols-fr grid-flow-col",
        "[&>*]:min-w-0 [&>*]:px-3 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-line",
        card ? "card py-3.5 [&>*:first-child]:pl-4" : "[&>*:first-child]:pl-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type MeterSegment = {
  value: number;
  label?: ReactNode;
  /** CSS colour. Defaults by `kind`. */
  color?: string;
  kind?: "done" | "planned" | "free" | "over";
};

const METER_KIND: Record<NonNullable<MeterSegment["kind"]>, string> = {
  done: "var(--tint)",
  planned: "color-mix(in oklab, var(--tint) 38%, var(--surface))",
  free: "transparent",
  over: "var(--bad)",
};

/**
 * A capacity bar: segments laid end to end over `total` (defaults to their sum),
 * with an optional legend. Use `TimeMeter` for done / planned / free minutes.
 */
export function Meter({
  segments,
  total,
  legend = true,
  height = 8,
  className,
}: {
  segments: MeterSegment[];
  total?: number;
  legend?: boolean;
  /** px */
  height?: number;
  className?: string;
}) {
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const max = Math.max(total ?? sum, sum, 1);
  const colorOf = (s: MeterSegment) => s.color ?? METER_KIND[s.kind ?? "done"];
  return (
    <div className={className}>
      <div className="flex w-full overflow-hidden rounded-full bg-sunken" style={{ height }}>
        <div className="meter-grow flex h-full w-full gap-[2px]">
          {segments.map((s, i) =>
            s.value > 0 ? (
              <span
                key={i}
                className="h-full"
                style={{ width: `${(s.value / max) * 100}%`, background: colorOf(s), transition: "width 600ms var(--ease-spring)" }}
              />
            ) : null,
          )}
        </div>
      </div>
      {legend && segments.some((s) => s.label) && (
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-3">
          {segments.map((s, i) =>
            s.label ? (
              <span key={i} className="tnum inline-flex items-center gap-1.5">
                <span
                  className={cn("size-2 rounded-full", (s.kind === "free" || colorOf(s) === "transparent") && "border border-line-strong")}
                  style={{ background: colorOf(s) }}
                />
                {s.label}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

/** Minutes done / planned / free as a Meter, labelled "1h 20m done · 2h planned · 3h 40m free". */
export function TimeMeter({
  doneMin = 0,
  plannedMin = 0,
  freeMin = 0,
  overMin = 0,
  labels = { done: "done", planned: "planned", free: "free", over: "over" },
  legend = true,
  className,
}: {
  doneMin?: number;
  plannedMin?: number;
  freeMin?: number;
  overMin?: number;
  labels?: Partial<Record<"done" | "planned" | "free" | "over", string>>;
  legend?: boolean;
  className?: string;
}) {
  const l = { done: "done", planned: "planned", free: "free", over: "over", ...labels };
  const seg = (kind: MeterSegment["kind"] & string, value: number): MeterSegment => ({
    kind,
    value,
    label: value > 0 ? `${formatDuration(value)} ${l[kind]}` : undefined,
  });
  return (
    <Meter
      className={className}
      legend={legend}
      segments={[seg("done", doneMin), seg("planned", plannedMin), seg("over", overMin), seg("free", freeMin)]}
    />
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}
