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
