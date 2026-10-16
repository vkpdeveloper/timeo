import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getUser } from "@/lib/auth";
import { toClient } from "@/lib/ai/background";

/** Poll one run. Polling marks it as watched, so no push is sent while the app is open. */
export async function GET(_req: Request, ctx: RouteContext<"/api/assistant/runs/[id]">) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const where = and(eq(t.aiCommands.id, id), eq(t.aiCommands.userId, user.id));
  const row = await db.select().from(t.aiCommands).where(where).get();
  if (!row) return new Response("Not found", { status: 404 });
  if (row.status === "running") await db.update(t.aiCommands).set({ seenAt: Date.now() }).where(where);
  return Response.json(toClient(row));
}
