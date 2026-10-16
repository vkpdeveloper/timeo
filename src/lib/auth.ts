import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { todayIn } from "@/lib/dates";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "timeo_session";
const SESSION_DAYS = 60;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  await db.insert(t.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(t.sessions).where(eq(t.sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  dayStartMin: number;
  dayEndMin: number;
  today: string;
};

/** The signed-in user, or null. Deduplicated per request. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .select({
      id: t.users.id,
      name: t.users.name,
      email: t.users.email,
      timezone: t.users.timezone,
      dayStartMin: t.users.dayStartMin,
      dayEndMin: t.users.dayEndMin,
      expiresAt: t.sessions.expiresAt,
    })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(eq(t.sessions.id, hashToken(token)))
    .get();
  if (!row || row.expiresAt < Date.now()) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    timezone: row.timezone,
    dayStartMin: row.dayStartMin,
    dayEndMin: row.dayEndMin,
    today: todayIn(row.timezone),
  };
});

/** Use in pages and server actions: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
