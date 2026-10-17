import { isAuthorizedCron } from "@/lib/push/cron-auth";
import { runReminders } from "@/lib/push/reminders";

// Called every 5 minutes by the Cloudflare Worker in cron/ (CRON_SECRET), or
// manually by the GitHub Actions workflow (OIDC, no secret needed).
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) return new Response("Unauthorized", { status: 401 });
  const result = await runReminders();
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}

export const POST = GET;
