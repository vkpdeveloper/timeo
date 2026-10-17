"use client";

import { CalendarDays, Clock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calendar } from "@/components/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/cn";
import { addDays, formatMin, parseTime, toTimeInput, type ISODate } from "@/lib/dates";

/*
 * Date and time pickers built on shadcn Popover + Calendar. Drop-in for
 * <input type="date|time">: same "YYYY-MM-DD" / "HH:MM" values, and with
 * `name` they post a hidden input so server actions read them unchanged.
 */

const trigger =
  "field flex min-h-12 items-center gap-2 text-left text-[16px] data-[state=open]:border-(--focus) data-[state=open]:bg-surface data-[state=open]:shadow-[inset_0_0_0_1px_var(--focus)]";
// above the bottom Sheet (z-60)
const panel = "z-[80] rounded-[22px] border-line bg-surface p-0 shadow-float";

/* ─────────────────────────── Date ─────────────────────────── */

const fmtDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const fmtDateYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

// the calendar works in local dates; values stay timezone-free strings
const toLocal = (d: ISODate) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const fromLocal = (d: Date): ISODate =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localToday = () => fromLocal(new Date());

function dateLabel(d: ISODate, today: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const rel = d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : d === addDays(today, -1) ? "Yesterday" : null;
  const text = (y === Number(today.slice(0, 4)) ? fmtDate : fmtDateYear).format(utc);
  return { text, rel };
}

export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  today,
  placeholder = "Pick a date",
  clearable,
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: ISODate | "";
  defaultValue?: ISODate | "";
  onChange?: (v: ISODate | "") => void;
  min?: ISODate;
  max?: ISODate;
  /** The user's today (timezone aware); falls back to the device's date */
  today?: ISODate;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState<ISODate | "">(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const now = today ?? localToday();

  const set = (v: ISODate | "") => {
    setInner(v);
    onChange?.(v);
    setOpen(false);
  };

  const label = current ? dateLabel(current, now) : null;
  const inRange = (d: ISODate) => (!min || d >= min) && (!max || d <= max);
  const nextMonday = addDays(now, ((8 - new Date(`${now}T12:00:00Z`).getUTCDay()) % 7) || 7);
  const quick = [
    { label: "Today", value: now },
    { label: "Tomorrow", value: addDays(now, 1) },
    { label: "Next Mon", value: nextMonday },
  ].filter((q) => inRange(q.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={current} />}
      <PopoverTrigger className={cn(trigger, className)} aria-label={ariaLabel}>
        <span className={cn("min-w-0 flex-1 truncate tnum", !label && "text-ink-3")}>
          {label ? (
            <>
              {label.rel && <span className="font-medium text-ink">{label.rel} · </span>}
              <span className={label.rel ? "text-ink-2" : "text-ink"}>{label.text}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <CalendarDays className="size-[18px] shrink-0 text-ink-3" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} collisionPadding={12} onEscapeKeyDown={(e) => e.stopPropagation()} className={cn(panel, "w-[min(330px,calc(100vw-24px))]")}>
        {quick.length > 0 && (
          <div className="flex gap-1.5 border-b border-line px-3 pt-3 pb-2.5">
            {quick.map((q) => (
              <Chip key={q.label} className="flex-1" active={current === q.value} onClick={() => set(q.value)}>
                {q.label}
              </Chip>
            ))}
          </div>
        )}
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={current ? toLocal(current) : undefined}
          defaultMonth={toLocal(current || now)}
          onSelect={(d) => d && set(fromLocal(d))}
          disabled={[...(min ? [{ before: toLocal(min) }] : []), ...(max ? [{ after: toLocal(max) }] : [])]}
          modifiers={{ userToday: toLocal(now) }}
          modifiersClassNames={{ userToday: "[&_button]:font-semibold [&_button]:text-accent [&_button[data-selected-single=true]]:text-accent-ink" }}
          classNames={{ root: "w-full", today: "" }}
          className={cn(
            "p-3 [--cell-size:--spacing(10.5)]",
            // accent selection, round days
            "[&_td_button]:rounded-full [&_td_button]:text-[15px] [&_td_button[data-selected-single=true]]:bg-accent [&_td_button[data-selected-single=true]]:font-semibold [&_td_button[data-selected-single=true]]:text-accent-ink",
          )}
        />
        {clearable && current && (
          <div className="border-t border-line p-2">
            <button type="button" onClick={() => set("")} className="tap h-10 w-full rounded-xl text-[14px] font-medium text-ink-2 hover:bg-sunken">
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── Time ─────────────────────────── */

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function TimePicker({
  name,
  value,
  defaultValue,
  onChange,
  step = 300,
  placeholder = "Set time",
  clearable,
  suggestions,
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  /** "HH:MM" (24h) */
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  /** Minute granularity in seconds, like <input type="time" step> */
  step?: number;
  placeholder?: string;
  clearable?: boolean;
  /** One-tap choices shown above the wheels, e.g. durations after a start time */
  suggestions?: { label: string; value: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const min = parseTime(current);
  const stepMin = Math.max(1, Math.round(step / 60));

  const set = (v: string, close = false) => {
    setInner(v);
    onChange?.(v);
    if (close) setOpen(false);
  };

  // what the wheels show: the value, or 9:00 AM as a starting point
  const base = min ?? 9 * 60;
  const h24 = Math.floor(base / 60);
  const minute = base % 60;
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minutes = Array.from({ length: Math.ceil(60 / stepMin) }, (_, i) => i * stepMin);
  if (!minutes.includes(minute)) minutes.splice(minutes.findIndex((m) => m > minute) >>> 0, 0, minute);

  const pick = (next: { h12?: number; minute?: number; pm?: boolean }) => {
    const hh = next.h12 ?? h12;
    const isPm = next.pm ?? pm;
    const mm = next.minute ?? minute;
    set(toTimeInput(((hh % 12) + (isPm ? 12 : 0)) * 60 + mm));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={current} />}
      <PopoverTrigger className={cn(trigger, className)} aria-label={ariaLabel}>
        <span className={cn("min-w-0 flex-1 truncate tnum", min == null && "text-ink-3")}>{min != null ? formatMin(min) : placeholder}</span>
        <Clock className="size-[18px] shrink-0 text-ink-3" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} collisionPadding={12} onEscapeKeyDown={(e) => e.stopPropagation()} className={cn(panel, "w-[264px]")}>
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-line px-3 pt-3 pb-2.5">
            {suggestions.map((s) => (
              <Chip key={s.label} active={current === s.value} onClick={() => set(s.value, true)}>
                {s.label}
              </Chip>
            ))}
          </div>
        )}
        <div className="relative flex gap-1 p-2">
          {/* selection band */}
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-sunken" aria-hidden />
          <Wheel items={HOURS} selected={h12} render={(h) => String(h)} onPick={(h) => pick({ h12: h })} label="Hour" />
          <Wheel items={minutes} selected={minute} render={(m) => String(m).padStart(2, "0")} onPick={(m) => pick({ minute: m })} label="Minute" />
          <Wheel items={[false, true]} selected={pm} render={(p) => (p ? "PM" : "AM")} onPick={(p) => pick({ pm: p })} label="AM or PM" />
        </div>
        <div className="flex gap-2 border-t border-line p-2">
          {clearable && current && (
            <button type="button" onClick={() => set("", true)} className="tap h-10 flex-1 rounded-xl text-[14px] font-medium text-ink-2 hover:bg-sunken">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => (min == null ? set(toTimeInput(base), true) : setOpen(false))}
            className="tap h-10 flex-1 rounded-xl bg-accent text-[14px] font-semibold text-accent-ink"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ROW = 44;

/** A scrolling column; the selected item sits in the middle band. */
function Wheel<T extends string | number | boolean>({
  items,
  selected,
  render,
  onPick,
  label,
}: {
  items: T[];
  selected: T;
  render: (v: T) => string;
  onPick: (v: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const index = items.indexOf(selected);

  // keep the selection centred (on open and after each pick)
  useEffect(() => {
    const el = ref.current;
    if (!el || index < 0) return;
    const top = index * ROW;
    const first = el.dataset.ready !== "1";
    el.scrollTo({ top, behavior: first ? "instant" : "smooth" });
    el.dataset.ready = "1";
  }, [index]);

  // scrolling picks whatever lands in the band
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (i !== index) onPick(items[i]);
    }, 140);
  };
  useEffect(() => () => clearTimeout(settle.current), []);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      className="relative h-[220px] flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ paddingBlock: (220 - ROW) / 2 }}
    >
      {items.map((v) => {
        const active = v === selected;
        return (
          <button
            key={String(v)}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onPick(v)}
            className={cn(
              "tap block h-11 w-full snap-center rounded-xl text-center text-[17px] tnum transition-colors",
              active ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {render(v)}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ active, onClick, children, className }: { active?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "tap h-8 shrink-0 rounded-full px-3 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors",
        active ? "bg-accent text-accent-ink ring-accent" : "bg-surface text-ink-2 ring-line hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}
