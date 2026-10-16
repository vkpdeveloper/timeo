import { isAuthorizedCron } from "@/lib/push/cron-auth";
import { runReminders } from "@/lib/push/reminders";

// Called every few minutes by GitHub Actions (OIDC, no secret needed) or any
// scheduler holding CRON_SECRET (`Authorization: Bearer <CRON_SECRET>`).
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) return new Response("Unauthorized", { status: 401 });
  const result = await runReminders();
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}

export const POST = GET;
