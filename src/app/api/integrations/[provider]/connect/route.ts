import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { oauthAuthorizeUrl, oauthReady } from "@/lib/integrations/oauth";
import { getProvider } from "@/lib/integrations/registry";
import { beginOAuthFlow } from "@/lib/oauth-flow";

const SETTINGS = "/app/settings/integrations";

// Starts connecting an app from Settings: off to its consent screen, back at /api/integrations/callback.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/integrations/[provider]/connect">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { provider } = await ctx.params;
  const p = getProvider(provider);
  if (!p || !oauthReady(p.oauth)) redirect(`${SETTINGS}?connect=${encodeURIComponent(provider)}`);
  const flow = await beginOAuthFlow({ purpose: "integration", provider: p.id, userId: user.id });
  redirect(oauthAuthorizeUrl(p.oauth, flow));
}
