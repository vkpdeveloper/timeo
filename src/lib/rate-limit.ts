import "server-only";
import { headers } from "next/headers";

/*
 * Best-effort in-memory throttle for auth endpoints. Serverless instances
 * each keep their own counters, so treat this as a speed bump against
 * credential stuffing, not a hard guarantee (pair with platform WAF
 * limits for anything stronger).
 */

type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Client IP from the platform's forwarding headers. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Records an attempt for `key`; returns true while still under `max` in the window. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= max;
}

/** Clears a key after success so one good login resets the failure count. */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}
