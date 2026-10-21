import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db, t } from "@/db";
import { isPushEndpoint, type PushPayload } from "./types";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@timeo.app", pub, priv);
  configured = true;
  return true;
}

export const pushConfigured = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

/**
 * Sends a Web Push message to every device the user enabled. Subscriptions the
 * push service reports as gone (404/410) are removed. Returns devices reached.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const subs = await db.select().from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, userId));
  if (!subs.length) return 0;

  const body = JSON.stringify(payload);
  // Rows stored before endpoints were checked may point anywhere: never POST to them, drop them.
  const dead: string[] = subs.filter((s) => !isPushEndpoint(s.endpoint)).map((s) => s.id);
  const ok: string[] = [];
  await Promise.all(
    subs.filter((s) => isPushEndpoint(s.endpoint)).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60,
          urgency: "high",
          topic: payload.tag?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        ok.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("push failed", status, (e as Error).message);
      }
    }),
  );
  if (dead.length) await db.delete(t.pushSubscriptions).where(inArray(t.pushSubscriptions.id, dead));
  if (ok.length) await db.update(t.pushSubscriptions).set({ lastSentAt: Date.now() }).where(inArray(t.pushSubscriptions.id, ok));
  return ok.length;
}
