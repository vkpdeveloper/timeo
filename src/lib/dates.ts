// Calendar helpers. Days are "YYYY-MM-DD" strings interpreted in the user's
// timezone; all arithmetic is done on UTC dates to avoid DST drift.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function todayIn(timezone: string, now = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Minutes since midnight right now in the given timezone. */
export function nowMinIn(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** The timezone when the runtime knows it, otherwise UTC. */
export function validTimezone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

/** An instant as the day and minute of the day it falls on in `timezone`. */
export function zonedDayMin(ms: number, timezone: string): { date: ISODate; min: number } {
  let f = zoneFormats.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    zoneFormats.set(timezone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

/** The instant a wall-clock day and minute happens in `timezone` (the later one when DST repeats it). */
export function zonedInstant(date: ISODate, min: number, timezone: string): number {
  const wall = toUTCDate(date).getTime() + min * 60_000;
  const offsetAt = (ms: number) => {
    const z = zonedDayMin(ms, timezone);
    return toUTCDate(z.date).getTime() + z.min * 60_000 - (ms - (ms % 60_000));
  };
  const first = wall - offsetAt(wall);
  return wall - offsetAt(first);
}

export function toUTCDate(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fromUTCDate(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTCDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTCDate(x);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTCDate(a).getTime() - toUTCDate(b).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(d: ISODate): number {
  return (toUTCDate(d).getUTCDay() + 6) % 7;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekday(d));
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toUTCDate(s);
  // Date.UTC rolls impossible days over (2026-02-31 becomes Mar 3), so
  // a round-trip must reproduce the input exactly.
  return !isNaN(d.getTime()) && fromUTCDate(d) === s;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts });

const fmtWeekdayLong = fmt({ weekday: "long" });
const fmtWeekdayShort = fmt({ weekday: "short" });
const fmtMonthDay = fmt({ month: "short", day: "numeric" });
const fmtLong = fmt({ weekday: "long", month: "long", day: "numeric" });

export const formatWeekday = (d: ISODate) => fmtWeekdayLong.format(toUTCDate(d));
export const formatWeekdayShort = (d: ISODate) => fmtWeekdayShort.format(toUTCDate(d));
export const formatMonthDay = (d: ISODate) => fmtMonthDay.format(toUTCDate(d));
export const formatLongDate = (d: ISODate) => fmtLong.format(toUTCDate(d));
export const dayOfMonth = (d: ISODate) => toUTCDate(d).getUTCDate();

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/** Relative label: Today, Tomorrow, Yesterday, or "Tue, Oct 27". */
export function relativeDay(d: ISODate, today: ISODate): string {
  const diff = diffDays(d, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return formatWeekday(d);
  return `${formatWeekdayShort(d)}, ${formatMonthDay(d)}`;
}

/** 570 -> "9:30 AM" */
export function formatMin(min: number, compact = false): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  if (compact) return m === 0 ? `${h}${suffix.toLowerCase()}` : `${h}:${pad(m)}${suffix.toLowerCase()}`;
  return `${h}:${pad(m)} ${suffix}`;
}

/** "09:30" -> 570 */
export function parseTime(s: string | null | undefined): number | null {
  if (!s) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 570 -> "09:30" for <input type="time"> */
export function toTimeInput(min: number | null | undefined): string {
  if (min == null) return "";
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** 95 -> "1h 35m" */
export function formatDuration(min: number): string {
  const rounded = Math.round(min);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const SEASON_DAYS = 84;
