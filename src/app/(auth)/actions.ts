"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { seedNewUser } from "@/lib/seed";

export type AuthState = { error?: string; email?: string; name?: string } | undefined;

const validTimezone = (tz: unknown) => {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const timezone = validTimezone(formData.get("timezone"));

  if (!name) return { error: "What should we call you?", email, name };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right.", email, name };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email, name };

  const existing = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, email)).get();
  if (existing) return { error: "An account with this email already exists. Sign in instead.", email, name };

  const id = crypto.randomUUID();
  await db.insert(t.users).values({ id, name, email, passwordHash: await hashPassword(password), timezone });
  await seedNewUser(id);
  await createSession(id);
  redirect("/goals/setup");
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const timezone = validTimezone(formData.get("timezone"));

  const user = await db.select().from(t.users).where(eq(t.users.email, email)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect.", email };
  }
  if (timezone !== "UTC" && timezone !== user.timezone) {
    await db.update(t.users).set({ timezone }).where(eq(t.users.id, user.id));
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
