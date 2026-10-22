import { addDays, validTimezone, weekday, zonedInstant } from "@/lib/dates";

// Just enough iCalendar (RFC 5545) to show a shared calendar: timed VEVENTs, their timezones,
// and recurrence (RRULE with the common BY parts, EXDATE, and moved or cancelled instances).

type Prop = { name: string; params: Record<string, string>; value: string };

/** A wall-clock moment and the timezone it's in. */
type Local = { date: string; min: number; tz: string };

export type IcsEvent = { id: string; title: string; start: number; end: number; url: string | null };

export type IcsCalendar = { name: string | null; events: (from: number, to: number) => IcsEvent[] };

function lines(text: string): Prop[] {
  const out: Prop[] = [];
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    // NAME;PARAM=a;PARAM="b:c":value: the value starts at the first colon outside quotes
    let colon = -1;
    for (let i = 0, quoted = false; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ":" && !quoted) {
        colon = i;
        break;
      }
    }
    if (colon < 1) continue;
    const [name, ...rest] = line.slice(0, colon).split(";");
    const params: Record<string, string> = {};
    for (const p of rest) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
    out.push({ name: name.toUpperCase(), params, value: line.slice(colon + 1) });
  }
  return out;
}

const plain = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** An IANA zone from a TZID, which some apps prefix with a path ("/mozilla.org/…/Europe/Paris"). */
function zone(tzid: string | undefined, fallback: string) {
  if (!tzid) return fallback;
  const parts = tzid.split("/").filter(Boolean);
  for (let i = Math.max(0, parts.length - 3); i < parts.length; i++) {
    const candidate = parts.slice(i).join("/");
    if (validTimezone(candidate) === candidate && candidate !== "UTC") return candidate;
  }
  return /^(utc|gmt|z)$/i.test(tzid) ? "UTC" : fallback;
}

const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

/** A DATE-TIME as wall clock in its zone; null for all-day (DATE) values. */
function local(value: string, tzid: string | undefined, fallback: string): Local | null {
  const m = DATE_TIME.exec(value.trim());
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, min: Number(m[4]) * 60 + Number(m[5]), tz: m[7] ? "UTC" : zone(tzid, fallback) };
}

const instant = (l: Local) => zonedInstant(l.date, l.min, l.tz);

function duration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [w, d, h, min, s] = m.slice(2).map((x) => Number(x ?? 0));
  const ms = ((((w * 7 + d) * 24 + h) * 60 + min) * 60 + s) * 1000;
  return m[1] === "-" ? -ms : ms;
}

// ───────────────────────────── Recurrence ─────────────────────────────

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  /** last day (DATE) or last instant (DATE-TIME) */
  untilDate?: string;
  untilMs?: number;
  byDay?: { n: number; wd: number }[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  wkst: number;
};

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function parseRule(value: string): Rule | null {
  const p = Object.fromEntries(value.split(";").map((kv) => kv.split("=") as [string, string]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(p.FREQ)) return null;
  const nums = (s?: string) => s?.split(",").map(Number).filter((n) => Number.isInteger(n) && n !== 0);
  const rule: Rule = {
    freq: p.FREQ as Rule["freq"],
    interval: Math.max(1, Number(p.INTERVAL) || 1),
    count: p.COUNT ? Number(p.COUNT) : undefined,
    byMonthDay: nums(p.BYMONTHDAY),
    byMonth: nums(p.BYMONTH),
    bySetPos: nums(p.BYSETPOS),
    wkst: Math.max(0, WEEKDAYS.indexOf(p.WKST ?? "MO")),
  };
  if (p.BYDAY) {
    rule.byDay = p.BYDAY.split(",").flatMap((s) => {
      const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(s.trim());
      return m ? [{ n: Number(m[1] ?? 0), wd: WEEKDAYS.indexOf(m[2]) }] : [];
    });
  }
  if (p.UNTIL) {
    const d = DATE.exec(p.UNTIL);
    const dt = DATE_TIME.exec(p.UNTIL);
    if (d) rule.untilDate = `${d[1]}-${d[2]}-${d[3]}`;
    else if (dt) rule.untilMs = Date.UTC(+dt[1], +dt[2] - 1, +dt[3], +dt[4], +dt[5], +dt[6]);
  }
  return rule;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The days of one month a rule picks, in order. */
function monthDays(y: number, m: number, rule: Rule, startDay: number): string[] {
  const len = daysIn(y, m);
  let days: number[];
  if (rule.byMonthDay?.length) {
    days = rule.byMonthDay.map((n) => (n > 0 ? n : len + n + 1)).filter((n) => n >= 1 && n <= len);
    if (rule.byDay?.length) days = days.filter((d) => rule.byDay!.some((b) => b.wd === weekday(ymd(y, m, d))));
  } else if (rule.byDay?.length) {
    days = [];
    for (const { n, wd } of rule.byDay) {
      const matches: number[] = [];
      for (let d = 1; d <= len; d++) if (weekday(ymd(y, m, d)) === wd) matches.push(d);
      if (n === 0) days.push(...matches);
      else {
        const pick = n > 0 ? matches[n - 1] : matches[matches.length + n];
        if (pick) days.push(pick);
      }
    }
  } else {
    days = startDay <= len ? [startDay] : [];
  }
  return [...new Set(days)].sort((a, b) => a - b).map((d) => ymd(y, m, d));
}

function setPos(list: string[], rule: Rule) {
  if (!rule.bySetPos?.length) return list;
  return rule.bySetPos.map((n) => (n > 0 ? list[n - 1] : list[list.length + n])).filter((d): d is string => !!d).sort();
}

/** Days an event repeats on, from its first day through `last`, as many as the rule allows. */
function* recur(rule: Rule, start: string, last: string): Generator<string> {
  const [sy, sm, sd] = start.split("-").map(Number);
  // each step is one period (day, week, month, year); the cap ends rules that never match
  for (let k = 0; k < 20_000; k++) {
    let days: string[];
    if (rule.freq === "DAILY") {
      const d = addDays(start, k * rule.interval);
      if (d > last) return;
      const [, m, day] = d.split("-").map(Number);
      const ok =
        (!rule.byMonth?.length || rule.byMonth.includes(m)) &&
        (!rule.byDay?.length || rule.byDay.some((b) => b.wd === weekday(d))) &&
        (!rule.byMonthDay?.length || rule.byMonthDay.includes(day));
      days = ok ? [d] : [];
    } else if (rule.freq === "WEEKLY") {
      const weekStart = addDays(start, -((weekday(start) - rule.wkst + 7) % 7) + 7 * k * rule.interval);
      if (weekStart > last) return;
      const wds = rule.byDay?.length ? rule.byDay.map((b) => b.wd) : [weekday(start)];
      days = setPos(
        [...new Set(wds)].map((wd) => addDays(weekStart, (wd - rule.wkst + 7) % 7)).sort(),
        rule,
      );
    } else if (rule.freq === "MONTHLY") {
      const total = sm - 1 + k * rule.interval;
      const y = sy + Math.floor(total / 12);
      const m = (total % 12) + 1;
      if (ymd(y, m, 1) > last) return;
      days = rule.byMonth?.length && !rule.byMonth.includes(m) ? [] : setPos(monthDays(y, m, rule, sd), rule);
    } else {
      const y = sy + k * rule.interval;
      if (ymd(y, 1, 1) > last) return;
      const months = rule.byMonth?.length ? rule.byMonth : [sm];
      days = setPos(months.flatMap((m) => monthDays(y, m, rule, sd)), rule);
    }
    for (const d of days) {
      if (d < start) continue;
      if (d > last) return;
      yield d;
    }
  }
}

// ───────────────────────────── Calendar ─────────────────────────────

type VEvent = {
  uid: string;
  title: string;
  start: Local;
  durationMs: number;
  url: string | null;
  rule: Rule | null;
  exInstants: Set<number>;
  exDates: Set<string>;
  /** set on an edited or cancelled instance of a repeating event */
  recurrenceId: number | null;
  skip: boolean;
};

/** Reads an .ics file. Floating times and unknown zones are taken as `timezone`. */
export function parseIcs(text: string, timezone: string): IcsCalendar {
  const props = lines(text);
  let name: string | null = null;
  const vevents: VEvent[] = [];
  let cur: Prop[] | null = null;
  let depth = 0;
  for (const p of props) {
    if (p.name === "X-WR-CALNAME" && !cur) name = plain(p.value) || null;
    if (p.name === "BEGIN") {
      if (p.value.toUpperCase() === "VEVENT" && !cur) {
        cur = [];
        depth = 0;
      } else if (cur) depth++;
      continue;
    }
    if (p.name === "END" && cur) {
      if (depth > 0) depth--;
      else {
        const e = toVEvent(cur, timezone);
        if (e) vevents.push(e);
        cur = null;
      }
      continue;
    }
    // properties of nested blocks (alarms) don't belong to the event
    if (cur && depth === 0) cur.push(p);
  }

  // edited instances replace the instance they were made from
  const moved = new Map<string, Set<number>>();
  for (const e of vevents) {
    if (e.recurrenceId == null) continue;
    let set = moved.get(e.uid);
    if (!set) moved.set(e.uid, (set = new Set()));
    set.add(e.recurrenceId);
  }

  return {
    name,
    events(from, to) {
      const out: IcsEvent[] = [];
      // in wall-clock days, a day either side so every zone is covered
      const lastDay = new Date(to + 86_400_000).toISOString().slice(0, 10);
      for (const e of vevents) {
        if (e.skip) continue;
        const first = instant(e.start);
        if (!e.rule || e.recurrenceId != null) {
          if (first < to && first + e.durationMs > from) {
            out.push({ id: e.recurrenceId != null ? `${e.uid}/${e.recurrenceId}` : e.uid, title: e.title, start: first, end: first + e.durationMs, url: e.url });
          }
          continue;
        }
        const skipped = moved.get(e.uid);
        let n = 0;
        for (const day of recur(e.rule, e.start.date, lastDay)) {
          const start = zonedInstant(day, e.start.min, e.start.tz);
          if (e.rule.untilMs != null && start > e.rule.untilMs) break;
          if (e.rule.untilDate && day > e.rule.untilDate) break;
          if (e.rule.count != null && ++n > e.rule.count) break;
          if (start >= to) break;
          if (start + e.durationMs <= from) continue;
          if (e.exInstants.has(start) || e.exDates.has(day) || skipped?.has(start)) continue;
          out.push({ id: `${e.uid}/${start}`, title: e.title, start, end: start + e.durationMs, url: e.url });
        }
      }
      return out;
    },
  };
}

function toVEvent(props: Prop[], timezone: string): VEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const dtstart = get("DTSTART");
  if (!dtstart) return null;
  const start = local(dtstart.value, dtstart.params.TZID, timezone);
  // all-day events aren't busy time
  if (!start || dtstart.params.VALUE === "DATE") return null;

  let durationMs = 0;
  const dtend = get("DTEND");
  const dur = get("DURATION");
  if (dtend) {
    const end = local(dtend.value, dtend.params.TZID, timezone);
    if (end) durationMs = instant(end) - instant(start);
  } else if (dur) durationMs = duration(dur.value) ?? 0;

  const exInstants = new Set<number>();
  const exDates = new Set<string>();
  for (const ex of props.filter((p) => p.name === "EXDATE")) {
    for (const v of ex.value.split(",")) {
      const l = local(v, ex.params.TZID, start.tz);
      if (l) exInstants.add(instant(l));
      else {
        const d = DATE.exec(v.trim());
        if (d) exDates.add(`${d[1]}-${d[2]}-${d[3]}`);
      }
    }
  }

  const rid = get("RECURRENCE-ID");
  const ridLocal = rid ? local(rid.value, rid.params.TZID, start.tz) : null;
  const status = get("STATUS")?.value.toUpperCase();
  const rrule = get("RRULE");
  return {
    uid: get("UID")?.value ?? `${dtstart.value}-${get("SUMMARY")?.value ?? ""}`,
    title: plain(get("SUMMARY")?.value ?? ""),
    start,
    durationMs: Math.max(0, durationMs),
    url: get("URL")?.value.startsWith("https://") ? get("URL")!.value : null,
    rule: rrule ? parseRule(rrule.value) : null,
    exInstants,
    exDates,
    recurrenceId: ridLocal ? instant(ridLocal) : null,
    // a cancelled instance still hides the one it replaces, so it's kept, then skipped
    skip: status === "CANCELLED" || get("TRANSP")?.value.toUpperCase() === "TRANSPARENT",
  };
}
