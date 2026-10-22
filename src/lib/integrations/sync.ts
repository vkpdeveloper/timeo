import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, gte, inArray, isNotNull, isNull, like, lt, lte, ne, or } from "drizzle-orm";
import { db, t } from "@/db";
import type { Integration } from "@/db/schema";
import { addDays, zonedDayMin } from "@/lib/dates";
import { connect, setStatus } from "./connection";
import { getProvider } from "./registry";
import { ApiError, ReconnectError, type CalendarProvider, type Ctx, type ExternalEvent, type ExternalTask, type TaskProvider } from "./types";

/*
 * Keeps Timeo in step with connected apps.
 *
 * Calendars: events become read-only "meeting" blocks for two weeks back and six ahead, replaced
 * on every sync and removed when they disappear there.
 *
 * Tasks: open tasks become Timeo tasks. Each remembers what the copy there looked like at the
 * last sync (externalState: "open|<hash>" or "done|<hash>"), which settles who changed what:
 * - edited there (hash moved): the new title and date win here; edits made here otherwise stay
 * - checked off here: closed there; reopened here: reopened there
 * - closed or gone there: checked off here; reopened there: reopened here
 * Tasks deleted here are remembered (settings.hidden) so they don't come back.
 */

const DAY = 86_400_000;
const PAST_DAYS = 14;
const AHEAD_DAYS = 42;
/** "dated" scope: due by two weeks from today, overdue included */
const DUE_AHEAD = 14;
/** most open tasks brought in from one app */
const MAX_TASKS = 300;

type Write = Parameters<typeof db.batch>[0][number];

async function runBatch(writes: Write[]) {
  for (let i = 0; i < writes.length; i += 100) {
    const chunk = writes.slice(i, i + 100);
    await db.batch(chunk as [Write, ...Write[]]);
  }
}

// ───────────────────────────── Calendars ─────────────────────────────

type Piece = { date: string; startMin: number; endMin: number };

/** An event cut at midnight into one piece per day it touches, in the user's timezone. */
export function splitByDay(e: Pick<ExternalEvent, "start" | "end">, timezone: string): Piece[] {
  const a = zonedDayMin(e.start, timezone);
  // zero-length events (reminders) get a quarter hour
  const b = zonedDayMin(Math.max(e.end, e.start + 15 * 60_000), timezone);
  const out: Piece[] = [];
  if (a.date === b.date) {
    out.push({ date: a.date, startMin: a.min, endMin: b.min });
  } else {
    out.push({ date: a.date, startMin: a.min, endMin: 24 * 60 });
    for (let d = addDays(a.date, 1); d < b.date; d = addDays(d, 1)) out.push({ date: d, startMin: 0, endMin: 24 * 60 });
    if (b.min > 0) out.push({ date: b.date, startMin: 0, endMin: b.min });
  }
  return out.filter((p) => p.endMin - p.startMin >= 5);
}

async function syncCalendar(p: CalendarProvider, ctx: Ctx, row: Integration): Promise<boolean> {
  const from = addDays(ctx.today, -PAST_DAYS);
  const to = addDays(ctx.today, AHEAD_DAYS);
  const ids = ctx.settings.calendars ?? (await p.calendars(ctx)).filter((c) => c.on).map((c) => c.id);
  // a day of slack each side: the window is in the user's days, the request in instants
  const events = ids.length ? await p.events(ctx, ids, Date.parse(`${from}T00:00:00Z`) - DAY, Date.parse(`${to}T00:00:00Z`) + 2 * DAY) : [];

  type Want = Piece & { title: string; kind: "meeting" | "focus"; url: string | null };
  const want = new Map<string, Want>();
  const seen = new Set<string>();
  for (const e of events) {
    // multi-day spans read like all-day events, which stay out of the planner
    if (e.end - e.start > DAY) continue;
    // an invite on two of your calendars shows once
    const twin = `${e.title}|${e.start}|${e.end}`;
    if (seen.has(twin)) continue;
    seen.add(twin);
    for (const piece of splitByDay(e, ctx.timezone)) {
      if (piece.date < from || piece.date > to) continue;
      want.set(`${e.calendarId}/${e.id}/${piece.date}`, {
        ...piece,
        title: (e.title.trim() || "Busy").slice(0, 120),
        kind: e.kind ?? "meeting",
        url: e.url ?? null,
      });
    }
  }

  const have = await db
    .select({
      id: t.blocks.id,
      externalId: t.blocks.externalId,
      title: t.blocks.title,
      kind: t.blocks.kind,
      date: t.blocks.date,
      startMin: t.blocks.startMin,
      endMin: t.blocks.endMin,
      externalUrl: t.blocks.externalUrl,
    })
    .from(t.blocks)
    .where(and(eq(t.blocks.integrationId, row.id), gte(t.blocks.date, from), lte(t.blocks.date, to)));

  const writes: Write[] = [];
  for (const h of have) {
    const w = h.externalId ? want.get(h.externalId) : undefined;
    if (!w) {
      writes.push(db.delete(t.blocks).where(eq(t.blocks.id, h.id)));
      continue;
    }
    want.delete(h.externalId!);
    if (h.title !== w.title || h.kind !== w.kind || h.date !== w.date || h.startMin !== w.startMin || h.endMin !== w.endMin || h.externalUrl !== w.url) {
      writes.push(
        db
          .update(t.blocks)
          .set({ title: w.title, kind: w.kind, date: w.date, startMin: w.startMin, endMin: w.endMin, externalUrl: w.url })
          .where(eq(t.blocks.id, h.id)),
      );
    }
  }
  for (const [externalId, w] of want) {
    writes.push(
      db
        .insert(t.blocks)
        .values({
          userId: row.userId,
          title: w.title,
          kind: w.kind,
          date: w.date,
          startMin: w.startMin,
          endMin: w.endMin,
          source: row.provider,
          integrationId: row.id,
          externalId,
          externalUrl: w.url,
        })
        .onConflictDoNothing(),
    );
  }
  await runBatch(writes);
  return writes.length > 0;
}

// ───────────────────────────── Tasks ─────────────────────────────

const hashTask = (x: ExternalTask) =>
  createHash("sha1")
    .update(JSON.stringify([x.title, x.notes ?? "", x.due ?? "", x.dueMin ?? ""]))
    .digest("base64url")
    .slice(0, 16);

const parseState = (s: string | null) => {
  const [was, hash] = (s ?? "open|").split("|");
  return { done: was === "done", hash: hash ?? "" };
};
const state = (done: boolean, hash: string) => `${done ? "done" : "open"}|${hash}`;

const taskFields = (x: ExternalTask) => ({
  title: x.title.trim().slice(0, 200) || "Untitled",
  notes: x.notes?.trim().slice(0, 4000) || null,
  dueDate: x.due ?? null,
  dueMin: x.due ? (x.dueMin ?? null) : null,
  externalUrl: x.url ?? null,
});

const isGone = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 410);

/** Closes or reopens a task there. Returns false when it no longer exists there. */
async function pushDone(p: TaskProvider, ctx: Ctx, externalId: string, done: boolean) {
  try {
    await p.setDone(ctx, externalId, done);
    return true;
  } catch (e) {
    if (isGone(e)) return false;
    throw e;
  }
}

/** Stops a task following its app (it was deleted there); it stays here as a plain task. */
const unlink = (taskId: string) => db.update(t.tasks).set({ integrationId: null, externalState: null }).where(eq(t.tasks.id, taskId));

async function syncTasks(p: TaskProvider, ctx: Ctx, row: Integration): Promise<boolean> {
  const { items, complete } = await p.tasks(ctx);
  const remote = new Map(items.map((x) => [x.id, x]));
  const local = await db
    .select({ id: t.tasks.id, externalId: t.tasks.externalId, externalState: t.tasks.externalState, doneAt: t.tasks.doneAt })
    .from(t.tasks)
    .where(eq(t.tasks.integrationId, row.id));

  const writes: Write[] = [];
  const now = Date.now();
  for (const l of local) {
    if (!l.externalId) continue;
    const was = parseState(l.externalState);
    const r = remote.get(l.externalId);
    if (r) {
      const hash = hashTask(r);
      const patch: Partial<typeof t.tasks.$inferInsert> = {};
      let doneThere = false;
      if (was.done) {
        // reopened there
        if (l.doneAt) patch.doneAt = null;
      } else if (l.doneAt) {
        // checked off here
        if (!(await pushDone(p, ctx, l.externalId, true))) {
          writes.push(unlink(l.id));
          continue;
        }
        doneThere = true;
      }
      if (hash !== was.hash) Object.assign(patch, taskFields(r));
      patch.externalState = state(doneThere, hash);
      if (patch.externalState !== l.externalState || Object.keys(patch).length > 1) {
        writes.push(db.update(t.tasks).set(patch).where(eq(t.tasks.id, l.id)));
      }
    } else if (complete) {
      // not open there any more: closed, deleted, or no longer yours
      if (!was.done) {
        writes.push(db.update(t.tasks).set({ doneAt: l.doneAt ?? now, externalState: state(true, was.hash) }).where(eq(t.tasks.id, l.id)));
      } else if (!l.doneAt) {
        // reopened here after it was closed there
        if (await pushDone(p, ctx, l.externalId, false)) {
          writes.push(db.update(t.tasks).set({ externalState: state(false, was.hash) }).where(eq(t.tasks.id, l.id)));
        } else writes.push(unlink(l.id));
      }
    }
  }

  // New open tasks, soonest first, within the connection's scope
  const known = new Set(local.map((l) => l.externalId));
  const hidden = new Set(row.settings?.hidden ?? []);
  const scope = row.settings?.scope ?? p.scope ?? "dated";
  const horizon = addDays(ctx.today, DUE_AHEAD);
  const room = MAX_TASKS - local.filter((l) => !l.doneAt).length;
  const fresh = items
    .filter((x) => !known.has(x.id) && !hidden.has(x.id) && (scope === "all" || (x.due != null && x.due <= horizon)))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, Math.max(0, room));
  for (const x of fresh) {
    writes.push(
      db
        .insert(t.tasks)
        .values({
          userId: row.userId,
          ...taskFields(x),
          source: row.provider,
          integrationId: row.id,
          externalId: x.id,
          externalState: state(false, hashTask(x)),
        })
        .onConflictDoNothing(),
    );
  }
  await runBatch(writes);
  return writes.length > 0;
}

/**
 * Carries check-offs made in Timeo to their apps right away, without a full sync. Anything
 * that fails here is retried by the next sync.
 */
export async function pushTaskChanges(userId: string) {
  const pending = await db
    .select({ id: t.tasks.id, integrationId: t.tasks.integrationId, externalId: t.tasks.externalId, externalState: t.tasks.externalState, doneAt: t.tasks.doneAt })
    .from(t.tasks)
    .where(
      and(
        eq(t.tasks.userId, userId),
        isNotNull(t.tasks.integrationId),
        or(and(isNotNull(t.tasks.doneAt), like(t.tasks.externalState, "open|%")), and(isNull(t.tasks.doneAt), like(t.tasks.externalState, "done|%"))),
      ),
    );
  if (!pending.length) return;
  const rows = await db
    .select({ integration: t.integrations, timezone: t.users.timezone })
    .from(t.integrations)
    .innerJoin(t.users, eq(t.users.id, t.integrations.userId))
    .where(and(eq(t.integrations.userId, userId), inArray(t.integrations.id, [...new Set(pending.map((x) => x.integrationId!))]), eq(t.integrations.status, "ok")));
  for (const { integration, timezone } of rows) {
    const p = getProvider(integration.provider);
    if (p?.kind !== "tasks") continue;
    try {
      const ctx = connect(p, integration, timezone);
      for (const task of pending.filter((x) => x.integrationId === integration.id)) {
        const done = task.doneAt != null;
        const ok = await pushDone(p, ctx, task.externalId!, done);
        await (ok
          ? db.update(t.tasks).set({ externalState: state(done, parseState(task.externalState).hash) }).where(eq(t.tasks.id, task.id))
          : unlink(task.id));
      }
    } catch (e) {
      if (!(e instanceof ReconnectError)) console.error(`push to ${integration.provider} failed`, e);
    }
  }
}

/** Remembers a task deleted here so its app doesn't bring it back. */
export async function forgetTask(userId: string, task: { integrationId: string | null; externalId: string | null }) {
  if (!task.integrationId || !task.externalId) return;
  const row = await db
    .select({ id: t.integrations.id, settings: t.integrations.settings })
    .from(t.integrations)
    .where(and(eq(t.integrations.id, task.integrationId), eq(t.integrations.userId, userId)))
    .get();
  if (!row) return;
  const hidden = [...(row.settings?.hidden ?? []).filter((id) => id !== task.externalId), task.externalId].slice(-1000);
  await db.update(t.integrations).set({ settings: { ...row.settings, hidden } }).where(eq(t.integrations.id, row.id));
}

// ───────────────────────────── Running syncs ─────────────────────────────

/** Starts a sync unless one started less than `minAgeMs` ago. True when this caller got it. */
export async function claimSync(id: string, minAgeMs: number) {
  const now = Date.now();
  const won = await db
    .update(t.integrations)
    .set({ syncedAt: now })
    .where(and(eq(t.integrations.id, id), or(isNull(t.integrations.syncedAt), lt(t.integrations.syncedAt, now - minAgeMs))))
    .returning({ id: t.integrations.id });
  return won.length > 0;
}

/** Syncs one connection. Returns whether anything in Timeo changed. Never throws. */
export async function syncIntegration(row: Integration, timezone: string): Promise<boolean> {
  const p = getProvider(row.provider);
  if (!p) return false;
  try {
    const ctx = connect(p, row, timezone);
    const changed = p.kind === "calendar" ? await syncCalendar(p, ctx, row) : await syncTasks(p, ctx, row);
    await setStatus(row, null);
    return changed;
  } catch (e) {
    if (!(e instanceof ReconnectError)) console.error(`sync ${row.provider} failed`, e);
    await setStatus(row, e);
    return false;
  }
}

/** Syncs a user's connections that haven't synced for `minAgeMs`. Returns whether anything changed. */
export async function syncUser(userId: string, timezone: string, { minAgeMs, provider }: { minAgeMs: number; provider?: string }) {
  const rows = await db
    .select()
    .from(t.integrations)
    .where(
      and(
        eq(t.integrations.userId, userId),
        ne(t.integrations.status, "reconnect"),
        provider ? eq(t.integrations.provider, provider) : undefined,
        or(isNull(t.integrations.syncedAt), lt(t.integrations.syncedAt, Date.now() - minAgeMs)),
      ),
    );
  const results = await Promise.all(rows.map(async (row) => (await claimSync(row.id, minAgeMs)) && (await syncIntegration(row, timezone))));
  return results.some(Boolean);
}

/** Cron: syncs connections not synced for 15 minutes, a few at a time, within a time budget. */
export async function syncDue({ budgetMs = 40_000, minAgeMs = 15 * 60_000 } = {}) {
  const started = Date.now();
  const queue = await db
    .select({ integration: t.integrations, timezone: t.users.timezone })
    .from(t.integrations)
    .innerJoin(t.users, eq(t.users.id, t.integrations.userId))
    .where(
      and(
        ne(t.integrations.status, "reconnect"),
        or(isNull(t.integrations.syncedAt), lt(t.integrations.syncedAt, started - minAgeMs)),
      ),
    )
    .orderBy(asc(t.integrations.syncedAt))
    .limit(40);
  let synced = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next && Date.now() - started < budgetMs; next = queue.shift()) {
        if (!(await claimSync(next.integration.id, minAgeMs))) continue;
        await syncIntegration(next.integration, next.timezone);
        synced++;
      }
    }),
  );
  return { synced, left: queue.length };
}
