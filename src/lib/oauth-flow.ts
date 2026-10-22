import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { seal, unseal } from "@/lib/seal";

/*
 * One OAuth round trip (Google sign-in, or connecting an app): the state, PKCE verifier and nonce
 * live in a sealed, httpOnly cookie for ten minutes and are checked when the provider sends the
 * browser back. Starting a new flow replaces any unfinished one.
 */

const COOKIE = "timeo_oauth";
const MINUTES = 10;

export type OAuthFlow = {
  state: string;
  verifier: string;
  nonce: string;
  /** signin: Continue with Google; link: add Google sign-in to the signed-in account; integration: connect an app */
  purpose: "signin" | "link" | "integration";
  provider?: string;
  userId?: string;
  timezone?: string;
};

const random = (bytes = 24) => randomBytes(bytes).toString("base64url");

export async function beginOAuthFlow(flow: Omit<OAuthFlow, "state" | "verifier" | "nonce">) {
  const full: OAuthFlow = { ...flow, state: random(), verifier: random(48), nonce: random() };
  (await cookies()).set(COOKIE, seal({ ...full, exp: Date.now() + MINUTES * 60_000 }, COOKIE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: MINUTES * 60,
  });
  const challenge = createHash("sha256").update(full.verifier).digest("base64url");
  return { ...full, challenge };
}

/** The flow the provider just returned from, used up; null when it's missing, expired or forged. */
export async function endOAuthFlow(state: string | null): Promise<OAuthFlow | null> {
  const jar = await cookies();
  const flow = unseal<OAuthFlow & { exp: number }>(jar.get(COOKIE)?.value, COOKIE);
  jar.set(COOKIE, "", { path: "/api", maxAge: 0 });
  if (!flow || flow.exp < Date.now() || !state || flow.state !== state) return null;
  return flow;
}
