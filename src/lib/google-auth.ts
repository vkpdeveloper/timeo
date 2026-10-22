import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { appUrl } from "@/lib/email";
import { seal, unseal } from "@/lib/seal";

/*
 * "Continue with Google" (OpenID Connect, authorization code + PKCE). Sign-in only asks for
 * openid, email and profile: calendar and tasks access are separate, opt-in connections in
 * Settings → Integrations (src/lib/integrations), so signing up with Google never shares a calendar.
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are the same OAuth client those connections use.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const googleSignInEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => `${appUrl()}/api/auth/google/callback`;

export function googleSignInUrl(flow: { state: string; nonce: string; challenge: string }, loginHint?: string) {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: flow.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
}

export type GoogleProfile = { sub: string; email: string; name: string };

/** Trades the code for an ID token and returns the verified profile. Throws when anything is off. */
export async function googleProfile(code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google sent no ID token");
  const { payload } = await jwtVerify(id_token, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce) throw new Error("Google sign-in nonce mismatch");
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!payload.sub || !email || payload.email_verified !== true) throw new Error("Google didn't confirm an email");
  const given = typeof payload.given_name === "string" ? payload.given_name : "";
  const full = typeof payload.name === "string" ? payload.name : "";
  return { sub: payload.sub, email, name: (given || full || email.split("@")[0]).trim().slice(0, 80) };
}

/*
 * A Google account whose email already has a password account isn't linked on the spot: Timeo
 * never verified that the password account's owner holds the email. The Google identity waits in
 * a sealed cookie until the password is entered once on this device, then the two are linked.
 */

const LINK_COOKIE = "timeo_google_link";
const LINK_MINUTES = 10;

export async function holdGoogleLink(profile: GoogleProfile) {
  (await cookies()).set(LINK_COOKIE, seal({ ...profile, exp: Date.now() + LINK_MINUTES * 60_000 }, LINK_COOKIE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LINK_MINUTES * 60,
  });
}

/** The Google identity waiting to be linked, used up. */
export async function takeGoogleLink(): Promise<GoogleProfile | null> {
  const jar = await cookies();
  const raw = jar.get(LINK_COOKIE)?.value;
  if (!raw) return null;
  jar.delete(LINK_COOKIE);
  const held = unseal<GoogleProfile & { exp: number }>(raw, LINK_COOKIE);
  return held && held.exp > Date.now() ? held : null;
}
