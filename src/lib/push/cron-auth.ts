import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/*
 * Who may trigger /api/cron/notify:
 * 1. Anything holding CRON_SECRET (Vercel Cron, a cron service), or
 * 2. A GitHub Actions workflow in this repository, proven by GitHub's OIDC
 *    token. No secret to configure: GitHub signs a short-lived token saying
 *    which repository the workflow runs in, and we check that signature.
 */

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const CRON_AUDIENCE = "timeo-cron";
const jwks = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

export async function isAuthorizedCron(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    // Hash both sides so timingSafeEqual always compares equal lengths.
    const a = createHash("sha256").update(token).digest();
    const b = createHash("sha256").update(secret).digest();
    if (timingSafeEqual(a, b)) return true;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: GITHUB_ISSUER, audience: CRON_AUDIENCE });
    const repo = process.env.CRON_GITHUB_REPO || "vkpdeveloper/timeo";
    return payload.repository === repo;
  } catch {
    return false;
  }
}
