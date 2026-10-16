import { runReminders } from "@/lib/push/reminders";

// Called every few minutes by a scheduler (GitHub Actions, Vercel Cron or any
// cron service) with `Authorization: Bearer <CRON_SECRET>`.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runReminders();
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}

export const POST = GET;
