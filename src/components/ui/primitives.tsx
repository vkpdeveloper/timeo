import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

/** A titled group of content on a page. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8 first:mt-0", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
          {action && <div className="text-[13px] font-medium text-ink-3">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="tap inline-flex items-center gap-0.5 text-[13px] font-medium text-ink-3 hover:text-ink">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

/** Large, iOS-style page title. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4 pt-6 pb-5 lg:pt-10", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="display text-[40px] text-ink lg:text-[48px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
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
      <div className="flex h-12 items-center justify-between gap-3">
        <Link href={back} className="tap -ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 text-[15px] font-medium text-accent">
          <ChevronRight className="size-5 rotate-180" strokeWidth={2.2} />
          {backLabel}
        </Link>
        {title && <div className="truncate text-[15px] font-semibold text-ink">{title}</div>}
        <div className="flex min-w-14 justify-end">{action}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-sunken text-ink-2 [&_svg]:size-5">{icon}</div>
      )}
      <div className="text-[16px] font-semibold tracking-tight text-ink">{title}</div>
      {body && <p className="mt-1.5 max-w-[30ch] text-[14px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
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

/** Tappable list row inside a card. */
export function Row({
  href,
  children,
  className,
  chevron = true,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  chevron?: boolean;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {href && chevron && <ChevronRight className="size-4 shrink-0 text-ink-3" />}
    </>
  );
  const cls = cn(
    "flex items-center gap-3 px-4 py-3.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line",
    href && "tap active:bg-sunken",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Stat({
  label,
  value,
  unit,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="tnum text-[22px] font-semibold tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[12px] font-medium text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}
