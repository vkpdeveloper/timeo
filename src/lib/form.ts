// Small FormData readers used by server actions.
import { isValidISODate, parseTime } from "@/lib/dates";

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export function reqStr(fd: FormData, key: string, max = 500): string {
  const s = str(fd, key);
  if (!s) throw new Error(`Missing ${key}`);
  return s.slice(0, max);
}

export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n == null ? null : Math.round(n);
}

export function date(fd: FormData, key: string): string | null {
  const s = str(fd, key);
  return isValidISODate(s) ? s : null;
}

/** Reads an <input type="time"> value as minutes from midnight. */
export function time(fd: FormData, key: string): number | null {
  return parseTime(str(fd, key));
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function oneOf<T extends string>(fd: FormData, key: string, options: readonly T[], fallback: T): T {
  const s = str(fd, key);
  return s && (options as readonly string[]).includes(s) ? (s as T) : fallback;
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
