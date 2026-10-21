import { after } from "next/server";
import { and, count, desc, eq, gt, lte, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { createRun, executeRun, RUN_STALE_MS, toClient } from "@/lib/ai/background";
import { getUser } from "@/lib/auth";

// Runs keep going after the response is sent (Vercel waitUntil via `after`).
export const maxDuration = 300;

const MAX_RUNNING = 3;
const MAX_PER_HOUR = 40;
const MAX_PER_DAY = 200;

/** Start a background assistant run: { id?, text } → { id }. The client may pick the id so it can show the run right away. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; text?: unknown } | null;
  const input = (typeof body?.text === "string" ? body.text : "").trim().slice(0, 2000);
  if (!input) return new Response("Empty", { status: 400 });

  // A run that outlived maxDuration was killed with its function; mark it
  // so it stops counting as running and shows as failed in history.
  const now = Date.now();
  await db
    .update(t.aiCommands)
    .set({ status: "error", error: "Run timed out" })
    .where(and(eq(t.aiCommands.userId, user.id), eq(t.aiCommands.status, "running"), lte(t.aiCommands.createdAt, now - RUN_STALE_MS)));

  // Each run can burn 12 model steps; cap concurrency, hourly and daily
  // volume per account so a loop (or a script) cannot run up unbounded cost.
  // Insert first, then count including this row: of any set of concurrent
  // requests, the last one to insert sees every earlier row, so the caps
  // cannot be overshot (at worst a burst is rejected together).
  const wanted = body?.id;
  const id = await createRun(user.id, input, typeof wanted === "string" && /^[\w-]{16,64}$/.test(wanted) ? wanted : undefined);
  const mine = (...w: SQL[]) =>
    db.select({ n: count() }).from(t.aiCommands).where(and(eq(t.aiCommands.userId, user.id), ...w)).get();
  const [running, hour, day] = await Promise.all([
    mine(eq(t.aiCommands.status, "running"), gt(t.aiCommands.createdAt, now - RUN_STALE_MS)),
    mine(gt(t.aiCommands.createdAt, now - 3_600_000)),
    mine(gt(t.aiCommands.createdAt, now - 86_400_000)),
  ]);
  if ((running?.n ?? 0) > MAX_RUNNING || (hour?.n ?? 0) > MAX_PER_HOUR || (day?.n ?? 0) > MAX_PER_DAY) {
    await db.delete(t.aiCommands).where(and(eq(t.aiCommands.id, id), eq(t.aiCommands.userId, user.id)));
    return new Response("Too many runs. Wait for one to finish.", { status: 429 });
  }

  after(() => executeRun(user, id));
  return Response.json({ id });
}

/** Recent history, newest last. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(60, Math.max(1, Math.floor(raw))) : 40;
  const rows = await db
    .select()
    .from(t.aiCommands)
    .where(and(eq(t.aiCommands.userId, user.id)))
    .orderBy(desc(t.aiCommands.createdAt))
    .limit(limit);
  return Response.json({ runs: rows.reverse().map(toClient) });
}
