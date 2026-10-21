import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  libsql?: ReturnType<typeof createClient>;
};

// Fail loudly at runtime when production has no database configured,
// instead of silently writing to an ephemeral local file. The build
// phase only collects page data and may run without env, so it keeps
// the local fallback.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const url = process.env.TURSO_DATABASE_URL ?? (process.env.NODE_ENV === "production" && !isBuild ? undefined : "file:local.db");
if (!url) throw new Error("TURSO_DATABASE_URL is required in production");

const client =
  globalForDb.libsql ??
  createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export * as t from "./schema";
