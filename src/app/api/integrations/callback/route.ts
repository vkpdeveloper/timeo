import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { makeCtx } from "@/lib/integrations/connection";
import { saveConnection, syncSoon } from "@/lib/integrations/manage";
import { oauthExchange } from "@/lib/integrations/oauth";
import { getProvider } from "@/lib/integrations/registry";
import type { Integration } from "@/db/schema";
import { endOAuthFlow } from "@/lib/oauth-flow";

const SETTINGS = "/app/settings/integrations";

// Every app sends the browser back here after its consent screen.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const flow = await endOAuthFlow(sp.get("state"));
  if (!flow || flow.purpose !== "integration") redirect(`${SETTINGS}?error=connect`);
  const user = await getUser();
  if (!user || user.id !== flow.userId) redirect("/login");
  const p = getProvider(flow.provider ?? "");
  if (!p?.oauth) redirect(`${SETTINGS}?error=connect`);
  const failed = `${SETTINGS}?error=${p.id}`;

  const code = sp.get("code");
  // cancelled on the app's screen: just go back
  if (!code) redirect(sp.get("error") === "access_denied" ? SETTINGS : failed);

  let row: Integration | null = null;
  let missingScopes = false;
  try {
    const { creds, scope } = await oauthExchange(p.oauth, code, flow.verifier);
    // Google lets people untick permissions on its consent screen
    const granted = new Set(scope.split(/[\s,]+/));
    missingScopes = !!scope && !!p.oauth.required?.some((s) => !granted.has(s));
    if (!missingScopes) {
      const ctx = makeCtx(p, creds, {}, user.timezone);
      const account = await p.account(ctx);
      row = await saveConnection(user.id, p, { ...ctx.creds, ...account.creds }, account.label);
    }
  } catch (e) {
    console.error(`connecting ${p.id} failed`, e);
  }
  if (missingScopes) redirect(`${SETTINGS}?error=${p.id}&reason=scopes`);
  if (!row) redirect(failed);

  await syncSoon(row, user.timezone);
  redirect(`${SETTINGS}?connected=${p.id}`);
}
