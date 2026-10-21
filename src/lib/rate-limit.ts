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

// Keys come from unauthenticated input (IPs, emails), so the map is capped:
// past the cap, expired buckets go first, then the oldest by insertion
// (down to 90% so a flood does not rescan the whole map on every call).
const MAX_BUCKETS = 10_000;

function makeRoom(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  for (const k of buckets.keys()) {
    if (buckets.size < MAX_BUCKETS * 0.9) break;
    buckets.delete(k);
  }
}

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
    buckets.delete(key);
    if (buckets.size >= MAX_BUCKETS) makeRoom(now);
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
