// Client-safe push types and defaults.
import type { NotifyPrefs } from "@/db/schema";

export type { NotifyPrefs };

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  blocks: true,
  blockLeadMin: 5,
  morning: true,
  morningMin: 7 * 60 + 30,
  workout: true,
  evening: true,
  eveningMin: 21 * 60 + 30,
  weekly: true,
  water: false,
};

export const withDefaults = (p: Partial<NotifyPrefs> | null | undefined): NotifyPrefs => ({ ...DEFAULT_NOTIFY_PREFS, ...(p ?? {}) });

/**
 * Only real browser push services may be stored as endpoints. The server
 * POSTs to the endpoint on every notification, so an arbitrary https URL
 * would turn Web Push into an SSRF primitive.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com"];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com", ".push.services.mozilla.com"];

export function isPushEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    return PUSH_HOSTS.includes(u.hostname) || PUSH_HOST_SUFFIXES.some((s) => u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

/** What the service worker receives and shows. */
export type PushPayload = {
  title: string;
  body?: string;
  /** where a tap takes you */
  url?: string;
  /** same tag replaces an older notification instead of stacking */
  tag?: string;
  /** notification icon, defaults to the app icon */
  icon?: string;
};
