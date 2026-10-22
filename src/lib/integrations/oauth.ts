import "server-only";
import { appUrl } from "@/lib/email";
import { ReconnectError, type Creds, type OAuthConfig } from "./types";

// The OAuth 2.0 authorization-code flow, shared by every app that offers it.

const clientId = (c: OAuthConfig) => process.env[`${c.env}_CLIENT_ID`];
const clientSecret = (c: OAuthConfig) => process.env[`${c.env}_CLIENT_SECRET`];

export const oauthReady = (c: OAuthConfig | undefined): c is OAuthConfig => !!c && !!clientId(c) && !!clientSecret(c);

/** One callback for every app; the provider rides in the sealed flow cookie. */
export const oauthRedirectUri = () => `${appUrl()}/api/integrations/callback`;

export function oauthAuthorizeUrl(c: OAuthConfig, flow: { state: string; challenge: string }, loginHint?: string) {
  const url = new URL(c.authorizeUrl);
  const params: Record<string, string> = {
    client_id: clientId(c)!,
    redirect_uri: oauthRedirectUri(),
    response_type: "code",
    state: flow.state,
    ...(c.scopes.length ? { scope: c.scopes.join(c.scopeSeparator ?? " ") } : {}),
    ...(c.pkce ? { code_challenge: flow.challenge, code_challenge_method: "S256" } : {}),
    ...(loginHint ? { login_hint: loginHint } : {}),
    ...c.params,
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function tokenRequest(c: OAuthConfig, params: Record<string, string>): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { accept: "application/json" };
  const body: Record<string, string> = { ...params };
  if (c.clientAuth === "basic") {
    headers.authorization = `Basic ${Buffer.from(`${clientId(c)}:${clientSecret(c)}`).toString("base64")}`;
  } else {
    body.client_id = clientId(c)!;
    body.client_secret = clientSecret(c)!;
  }
  const url = new URL(c.tokenUrl);
  let payload: string | undefined;
  if (c.tokenFormat === "query") {
    for (const [k, v] of Object.entries(body)) url.searchParams.set(k, v);
  } else if (c.tokenFormat === "json") {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  } else {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // GitHub answers 200 with an error field
  if (!res.ok || typeof data.access_token !== "string") {
    const error = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    if (error === "invalid_grant" || res.status === 401) throw new ReconnectError(`Token refused: ${error}`);
    throw new Error(`Token request failed: ${error}`);
  }
  return data;
}

function toCreds(c: OAuthConfig, data: Record<string, unknown>, prev?: Creds): Creds {
  const expiresIn = Number(data.expires_in);
  return {
    ...prev,
    accessToken: data.access_token as string,
    // most apps send a refresh token only the first time; Microsoft sends a new one every time
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : prev?.refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    ...c.extra?.(data),
  };
}

/** Trades the callback's code for credentials. */
export async function oauthExchange(c: OAuthConfig, code: string, verifier: string): Promise<{ creds: Creds; scope: string }> {
  const data = await tokenRequest(c, {
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthRedirectUri(),
    ...(c.pkce ? { code_verifier: verifier } : {}),
    ...c.tokenParams,
  });
  return { creds: toCreds(c, data), scope: typeof data.scope === "string" ? data.scope : "" };
}

export async function oauthRefresh(c: OAuthConfig, creds: Creds): Promise<Creds> {
  if (!creds.refreshToken) throw new ReconnectError("The token expired and can't be refreshed");
  const data = await tokenRequest(c, { grant_type: "refresh_token", refresh_token: creds.refreshToken });
  return toCreds(c, data, creds);
}
