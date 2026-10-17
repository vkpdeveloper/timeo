// Cloudflare Worker that calls Timeo's reminder endpoint every 5 minutes
// (Cron Triggers are free). Deploy: `npx wrangler deploy` from this folder.
// Secret: `npx wrangler secret put CRON_SECRET` (same value as on Vercel).

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(notify(env));
  },
};

async function notify(env) {
  const res = await fetch(`${env.TIMEO_URL}/api/cron/notify`, {
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(res.status, body.slice(0, 300));
  if (!res.ok) throw new Error(`notify failed: ${res.status}`);
}
