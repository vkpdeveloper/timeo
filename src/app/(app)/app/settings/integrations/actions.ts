"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import type { IntegrationSettings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { connect, describe, makeCtx } from "@/lib/integrations/connection";
import { clearImported, removeConnection, saveConnection, syncSoon } from "@/lib/integrations/manage";
import { notionMapping, notionSources } from "@/lib/integrations/providers/notion";
import { getProvider } from "@/lib/integrations/registry";
import type { Choice } from "@/lib/integrations/types";
import { ApiError, ReconnectError } from "@/lib/integrations/types";

export type Result = { error?: string } | void;

async function ownIntegration(id: unknown) {
  const user = await requireUser();
  if (typeof id !== "string") return { user, row: null };
  const row = await db
    .select()
    .from(t.integrations)
    .where(and(eq(t.integrations.id, id), eq(t.integrations.userId, user.id)))
    .get();
  return { user, row: row ?? null };
}

/** Connects an app with a pasted token or link (and Trello's token from its fragment). */
export async function connectWithToken(provider: string, values: Record<string, string>): Promise<Result> {
  const user = await requireUser();
  const p = getProvider(provider);
  if (!p || (!p.token && !p.fragment)) return { error: "This app can't be connected that way" };
  const clean = Object.fromEntries(
    Object.entries(values ?? {})
      .filter(([k, v]) => typeof k === "string" && typeof v === "string")
      .map(([k, v]) => [k, v.slice(0, 2000)]),
  );
  const creds = p.token ? p.token.creds(clean) : clean.token ? { accessToken: clean.token.trim() } : "Connecting didn't finish";
  if (typeof creds === "string") return { error: creds };

  let label: string;
  const ctx = makeCtx(p, creds, {}, user.timezone);
  try {
    const account = await p.account(ctx);
    label = account.label;
    Object.assign(ctx.creds, account.creds);
  } catch (e) {
    if (e instanceof ReconnectError || (e instanceof ApiError && (e.status === 401 || e.status === 403))) {
      return { error: "That was refused. Check it and try again." };
    }
    if (p.id === "apple-calendar") return { error: "Couldn't read a calendar at that link" };
    console.error(`connecting ${p.id} failed`, e);
    return { error: describe(e) };
  }
  const row = await saveConnection(user.id, p, ctx.creds, label);
  await syncSoon(row, user.timezone);
  refresh();
}

export async function disconnectIntegration(id: string): Promise<Result> {
  const user = await requireUser();
  await removeConnection(user.id, id);
  refresh();
}

export async function syncIntegrationNow(id: string): Promise<Result> {
  const { user, row } = await ownIntegration(id);
  if (!row) return { error: "Not connected" };
  await syncSoon(row, user.timezone);
  refresh();
  const after = await db.select({ error: t.integrations.error }).from(t.integrations).where(eq(t.integrations.id, row.id)).get();
  if (after?.error) return { error: after.error };
}

/** A calendar connection's calendars, marked with the ones shown. */
export async function listCalendars(id: string): Promise<{ calendars?: Choice[]; error?: string }> {
  const { user, row } = await ownIntegration(id);
  const p = row && getProvider(row.provider);
  if (!row || p?.kind !== "calendar") return { error: "Not connected" };
  try {
    const all = await p.calendars(connect(p, row, user.timezone));
    const picked = row.settings?.calendars;
    return { calendars: picked ? all.map((c) => ({ ...c, on: picked.includes(c.id) })) : all };
  } catch (e) {
    return { error: describe(e) };
  }
}

async function saveSettings(id: string, change: (s: IntegrationSettings) => IntegrationSettings) {
  const { user, row } = await ownIntegration(id);
  if (!row) return { error: "Not connected" };
  const settings = change(row.settings ?? {});
  await db.update(t.integrations).set({ settings }).where(eq(t.integrations.id, row.id));
  await syncSoon({ ...row, settings }, user.timezone);
  refresh();
}

export async function saveCalendars(id: string, calendarIds: string[]): Promise<Result> {
  if (!Array.isArray(calendarIds) || calendarIds.length > 200 || calendarIds.some((c) => typeof c !== "string" || c.length > 500)) {
    return { error: "Pick calendars from the list" };
  }
  return saveSettings(id, (s) => ({ ...s, calendars: calendarIds }));
}

export async function saveScope(id: string, scope: "dated" | "all"): Promise<Result> {
  if (scope !== "dated" && scope !== "all") return { error: "Pick which tasks to bring in" };
  return saveSettings(id, (s) => ({ ...s, scope }));
}

export async function listNotionSources(id: string): Promise<{ sources?: Choice[]; error?: string }> {
  const { user, row } = await ownIntegration(id);
  const p = row && getProvider(row.provider);
  if (!row || !p || p.id !== "notion") return { error: "Not connected" };
  try {
    const sources = await notionSources(connect(p, row, user.timezone));
    return { sources: sources.map((s) => ({ ...s, on: s.id === row.settings?.notion?.source })) };
  } catch (e) {
    return { error: describe(e) };
  }
}

export async function saveNotionSource(id: string, source: string): Promise<Result> {
  const { user, row } = await ownIntegration(id);
  const p = row && getProvider(row.provider);
  if (!row || !p || p.id !== "notion" || typeof source !== "string") return { error: "Not connected" };
  let mapping: Awaited<ReturnType<typeof notionMapping>>;
  try {
    mapping = await notionMapping(connect(p, row, user.timezone), source);
  } catch (e) {
    return { error: describe(e) };
  }
  if (typeof mapping === "string") return { error: mapping };
  // tasks from the database used before leave with it
  const switched = !!row.settings?.notion && row.settings.notion.source !== mapping.source;
  if (switched) await clearImported(row.id);
  const settings = { ...row.settings, notion: mapping, hidden: switched ? [] : row.settings?.hidden };
  await db.update(t.integrations).set({ settings }).where(eq(t.integrations.id, row.id));
  await syncSoon({ ...row, settings }, user.timezone);
  refresh();
}
