import { after } from "next/server";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { db, t } from "@/db";
import { createRun, executeRun, toClient } from "@/lib/ai/background";
import { getUser } from "@/lib/auth";

// Runs keep going after the response is sent (Vercel waitUntil via `after`).
export const maxDuration = 300;

const MAX_RUNNING = 3;
const MAX_PER_HOUR = 40;

/** Start a background assistant run: { id?, text } → { id }. The client may pick the id so it can show the run right away. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; text?: unknown } | null;
  const input = (typeof body?.text === "string" ? body.text : "").trim().slice(0, 2000);
  if (!input) return new Response("Empty", { status: 400 });

  // Each run can burn 12 model steps; cap concurrency and hourly volume
  // per account so a loop (or a script) cannot run up unbounded cost.
  const [running, recent] = await Promise.all([
    db.select({ n: count() }).from(t.aiCommands).where(and(eq(t.aiCommands.userId, user.id), eq(t.aiCommands.status, "running"))).get(),
    db.select({ n: count() }).from(t.aiCommands).where(and(eq(t.aiCommands.userId, user.id), gt(t.aiCommands.createdAt, Date.now() - 3_600_000))).get(),
  ]);
  if ((running?.n ?? 0) >= MAX_RUNNING || (recent?.n ?? 0) >= MAX_PER_HOUR) {
    return new Response("Too many runs. Wait for one to finish.", { status: 429 });
  }
  const wanted = body?.id;

  const id = await createRun(user.id, input, typeof wanted === "string" && /^[\w-]{16,64}$/.test(wanted) ? wanted : undefined);
  after(() => executeRun(user, id));
  return Response.json({ id });
}

/** Recent history, newest last. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(60, Math.floor(raw)) : 40;
  const rows = await db
    .select()
    .from(t.aiCommands)
    .where(and(eq(t.aiCommands.userId, user.id)))
    .orderBy(desc(t.aiCommands.createdAt))
    .limit(limit);
  return Response.json({ runs: rows.reverse().map(toClient) });
}
