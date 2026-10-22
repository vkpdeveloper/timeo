import { zonedDayMin } from "@/lib/dates";

export const enc = encodeURIComponent;

/** Most open tasks read from one app in a sync; past this the list counts as incomplete. */
export const READ_LIMIT = 2000;

type Due = { due: string | null; dueMin: number | null };

/** An instant as the day and minute it falls on for the user. */
export function dueAt(ms: number, timezone: string): Due {
  const z = zonedDayMin(ms, timezone);
  return { due: z.date, dueMin: z.min };
}

/**
 * A due value as the user's day and minute: "2026-10-22" (a day), "2026-10-22T09:30:00"
 * (wall-clock, taken as the user's), or an instant with Z or an offset.
 */
export function parseDue(value: string | null | undefined, timezone: string): Due {
  if (!value) return { due: null, dueMin: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { due: value, dueMin: null };
  const wall = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (wall) return { due: wall[1], dueMin: Number(wall[2]) * 60 + Number(wall[3]) };
  // "+0000" → "+00:00", which Date.parse reads everywhere
  const ms = Date.parse(value.replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
  return Number.isFinite(ms) ? dueAt(ms, timezone) : { due: null, dueMin: null };
}

/** Joins two ids into one external id ("<list>:<task>") for apps that need both to reach a task. */
export const pairId = (a: string, b: string) => `${a}:${b}`;
export function splitPair(id: string): [string, string] {
  const i = id.indexOf(":");
  return [id.slice(0, i), id.slice(i + 1)];
}
