import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { createRun, executeRun, toClient } from "@/lib/ai/background";
import { getUser } from "@/lib/auth";

// Runs keep going after the response is sent (Vercel waitUntil via `after`).
export const maxDuration = 300;

/** Start a background assistant run: { text } → { id } */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { text } = (await req.json()) as { text?: string };
  const input = (text ?? "").trim().slice(0, 2000);
  if (!input) return new Response("Empty", { status: 400 });

  const id = await createRun(user.id, input);
  after(() => executeRun(user, id));
  return Response.json({ id });
}

/** Recent history, newest last. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const limit = Math.min(60, Number(new URL(req.url).searchParams.get("limit")) || 40);
  const rows = await db
    .select()
    .from(t.aiCommands)
    .where(and(eq(t.aiCommands.userId, user.id)))
    .orderBy(desc(t.aiCommands.createdAt))
    .limit(limit);
  return Response.json({ runs: rows.reverse().map(toClient) });
}
