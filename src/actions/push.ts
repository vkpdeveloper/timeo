"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { clamp } from "@/lib/form";
import { sendToUser } from "@/lib/push/send";
import { isPushEndpoint, withDefaults, type NotifyPrefs } from "@/lib/push/types";

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Stores this device's push subscription (re-subscribing moves it to this user). */
export async function savePushSubscription(sub: SubscriptionJSON, userAgent?: string) {
  const user = await requireUser();
  const { endpoint, keys } = sub;
  if (!endpoint || !isPushEndpoint(endpoint) || !keys?.p256dh || !keys?.auth) throw new Error("Invalid subscription");
  await db
    .insert(t.pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null })
    .onConflictDoUpdate({
      target: t.pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    });
  refresh();
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db.delete(t.pushSubscriptions).where(and(eq(t.pushSubscriptions.endpoint, endpoint), eq(t.pushSubscriptions.userId, user.id)));
  refresh();
}

export async function sendTestPush() {
  const user = await requireUser();
  const reached = await sendToUser(user.id, {
    title: "Timeo",
    body: "Notifications are on. You'll hear from us when it matters.",
    url: "/settings/notifications",
    tag: "test",
  });
  return { reached };
}

const BOOL_KEYS = ["blocks", "morning", "workout", "evening", "weekly", "water"] as const;
const MIN_KEYS = ["blockLeadMin", "morningMin", "eveningMin"] as const;

/** Known keys with the right type only: raw client (or previously stored) JSON never reaches the row. */
function pickPrefs(p: unknown): Partial<NotifyPrefs> {
  const src = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const picked: Partial<NotifyPrefs> = {};
  for (const k of BOOL_KEYS) {
    const v = src[k];
    if (typeof v === "boolean") picked[k] = v;
  }
  for (const k of MIN_KEYS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) picked[k] = v;
  }
  return picked;
}

export async function saveNotifyPrefs(prefs: Partial<NotifyPrefs>) {
  const user = await requireUser();
  const row = await db.select({ p: t.users.notifyPrefs }).from(t.users).where(eq(t.users.id, user.id)).get();
  const next = withDefaults({ ...pickPrefs(row?.p), ...pickPrefs(prefs) });
  next.blockLeadMin = clamp(Math.round(next.blockLeadMin), 0, 60);
  next.morningMin = clamp(Math.round(next.morningMin), 0, 1439);
  next.eveningMin = clamp(Math.round(next.eveningMin), 0, 1439);
  await db.update(t.users).set({ notifyPrefs: next }).where(eq(t.users.id, user.id));
  refresh();
}
