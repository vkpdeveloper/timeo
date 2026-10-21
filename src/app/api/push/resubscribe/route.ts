import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getUser } from "@/lib/auth";
import { isPushEndpoint } from "@/lib/push/types";

// Called by the service worker when the browser rotates a push subscription.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { old, sub } = (await req.json()) as {
    old?: string;
    sub?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !isPushEndpoint(endpoint) || !p256dh || !auth) {
    return new Response("Bad request", { status: 400 });
  }
  if (old) await db.delete(t.pushSubscriptions).where(and(eq(t.pushSubscriptions.endpoint, old), eq(t.pushSubscriptions.userId, user.id)));
  await db
    .insert(t.pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: t.pushSubscriptions.endpoint, set: { userId: user.id, p256dh, auth } });
  return Response.json({ ok: true });
}
