import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { db, t } from "@/db";
import type { Integration } from "@/db/schema";
import { connect, sealCreds } from "./connection";
import { getProvider } from "./registry";
import { claimSync, syncIntegration } from "./sync";
import type { Creds, Provider } from "./types";

/** Saves a new or renewed connection. Switching to another account there starts it fresh. */
export async function saveConnection(userId: string, p: Provider, creds: Creds, account: string): Promise<Integration> {
  const values = { account, status: "ok" as const, error: null, syncedAt: null };
  const id = crypto.randomUUID();
  const [inserted] = await db
    .insert(t.integrations)
    .values({ id, userId, provider: p.id, credentials: sealCreds(id, creds), ...values })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const existing = await db
    .select()
    .from(t.integrations)
    .where(and(eq(t.integrations.userId, userId), eq(t.integrations.provider, p.id)))
    .get();
  if (!existing) throw new Error("Connection vanished while saving");
  if (existing.account !== account) await clearImported(existing.id);
  const credentials = sealCreds(existing.id, creds);
  await db.update(t.integrations).set({ credentials, ...values }).where(eq(t.integrations.id, existing.id));
  return { ...existing, credentials, ...values };
}

/**
 * Removes what a connection brought in: its calendar events, and imported tasks still open.
 * Finished ones stay, as plain tasks, so past days keep their record.
 */
export async function clearImported(integrationId: string) {
  await db.batch([
    db.delete(t.blocks).where(eq(t.blocks.integrationId, integrationId)),
    db.delete(t.tasks).where(and(eq(t.tasks.integrationId, integrationId), isNull(t.tasks.doneAt))),
    db.update(t.tasks).set({ integrationId: null, externalState: null }).where(eq(t.tasks.integrationId, integrationId)),
  ]);
}

export async function removeConnection(userId: string, integrationId: string) {
  const row = await db
    .select()
    .from(t.integrations)
    .where(and(eq(t.integrations.id, integrationId), eq(t.integrations.userId, userId)))
    .get();
  if (!row) return;
  const p = getProvider(row.provider);
  if (p?.revoke) {
    // Google revokes every scope a person gave the app at once, so keep the grant while
    // another Google connection still uses it
    const siblings = await db
      .select({ provider: t.integrations.provider })
      .from(t.integrations)
      .where(eq(t.integrations.userId, userId));
    const shared = siblings.some((s) => s.provider !== row.provider && getProvider(s.provider)?.oauth?.env === p.oauth?.env);
    if (!shared) {
      try {
        await p.revoke(connect(p, row, "UTC").creds);
      } catch {
        // best effort: the connection goes either way
      }
    }
  }
  await clearImported(row.id);
  await db.delete(t.integrations).where(eq(t.integrations.id, row.id));
}

/**
 * Syncs a connection that was just made or changed. Waits a few seconds so the page usually
 * opens with everything in place; a slower sync finishes in `after`.
 */
export async function syncSoon(row: Integration, timezone: string) {
  const job = (async () => (await claimSync(row.id, 5000)) && (await syncIntegration(row, timezone)))();
  after(job);
  await Promise.race([job, new Promise((r) => setTimeout(r, 6000))]);
}
