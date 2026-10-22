import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Integration, IntegrationSettings } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { seal, unseal } from "@/lib/seal";
import { oauthReady, oauthRefresh } from "./oauth";
import { ApiError, ReconnectError, type ApiInit, type Creds, type Ctx, type Provider } from "./types";

// A connection's credentials are sealed to its own row, so ciphertext copied to another row won't open.
const purpose = (integrationId: string) => `integration:${integrationId}`;

export const sealCreds = (integrationId: string, creds: Creds) => seal(creds, purpose(integrationId));

/** Builds the context a provider works in: the opened credentials and an authorised fetch. */
export function connect(
  provider: Provider,
  row: { id: string; credentials: string; settings: IntegrationSettings | null },
  timezone: string,
): Ctx {
  const creds = unseal<Creds>(row.credentials, purpose(row.id));
  if (!creds) throw new ReconnectError("Credentials can't be read");
  return makeCtx(provider, creds, row.settings ?? {}, timezone, async (next) => {
    await db.update(t.integrations).set({ credentials: sealCreds(row.id, next) }).where(eq(t.integrations.id, row.id));
  });
}

/** A context for credentials not saved yet (checking a pasted token before connecting). */
export function makeCtx(
  provider: Provider,
  creds: Creds,
  settings: IntegrationSettings,
  timezone: string,
  save?: (creds: Creds) => Promise<void>,
): Ctx {
  const ctx: Ctx = { creds, settings, timezone, today: todayIn(timezone), api: null! };
  const canRefresh = () => !!ctx.creds.refreshToken && oauthReady(provider.oauth);

  const refresh = async () => {
    ctx.creds = await oauthRefresh(provider.oauth!, ctx.creds);
    await save?.(ctx.creds);
  };

  const send = (url: string, init: ApiInit) => {
    const { json, form, headers, ...rest } = init;
    return fetch(url, {
      ...rest,
      headers: {
        accept: "application/json",
        ...(provider.headers ? provider.headers(ctx.creds) : { authorization: `Bearer ${ctx.creds.accessToken}` }),
        ...(json !== undefined ? { "content-type": "application/json" } : form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : form ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  };

  ctx.api = async <T,>(url: string, init: ApiInit = {}): Promise<T> => {
    if (ctx.creds.expiresAt && ctx.creds.expiresAt < Date.now() + 60_000 && canRefresh()) await refresh();
    let res = await send(url, init);
    if (res.status === 401 && canRefresh()) {
      await refresh();
      res = await send(url, init);
    }
    if (res.status === 401) throw new ReconnectError("Access was revoked or expired");
    const text = await res.text();
    if (!res.ok) throw new ApiError(res.status, `${new URL(url).host} ${res.status}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : null) as T;
  };
  return ctx;
}

/** Saves a sync's outcome on the connection. */
export async function setStatus(row: Pick<Integration, "id">, error: unknown) {
  const reconnect = error instanceof ReconnectError;
  await db
    .update(t.integrations)
    .set({
      status: error ? (reconnect ? "reconnect" : "error") : "ok",
      error: error ? describe(error) : null,
    })
    .where(eq(t.integrations.id, row.id));
}

/** A short, human line for a failed sync. */
export function describe(error: unknown): string {
  if (error instanceof ReconnectError) return "Access ended. Reconnect to keep syncing.";
  if (error instanceof ApiError) {
    if (error.status === 403) return "The app refused access. Check its permissions, then reconnect.";
    if (error.status === 429) return "The app asked us to slow down. Trying again soon.";
    if (error.status >= 500) return "The app is having trouble. Trying again soon.";
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The app took too long to answer.";
  return "Couldn't sync. Trying again soon.";
}

