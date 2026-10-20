"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, t } from "@/db";
import {
  consumePasswordReset,
  createPasswordReset,
  createSession,
  destroySession,
  hashPassword,
  RESET_MINUTES,
  verifyPassword,
} from "@/lib/auth";
import { appUrl, resetPasswordEmail, sendEmail } from "@/lib/email";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";
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
  await db.insert(t.users).values({ id, name, email, passwordHash: await hashPassword(password), timezone, aiModel: DEFAULT_AI_MODEL });
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

export type ForgotState = { sent?: boolean; error?: string; email?: string } | undefined;

/** Emails a reset link. Answers the same whether or not the account exists, and sends after the
 * response, so neither the reply nor its timing says which emails have accounts. */
export async function requestPasswordReset(_: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right.", email };

  after(async () => {
    const user = await db.select({ id: t.users.id, name: t.users.name }).from(t.users).where(eq(t.users.email, email)).get();
    if (!user) return;
    // one email a minute per account
    const recent = await db
      .select({ id: t.passwordResets.id })
      .from(t.passwordResets)
      .where(and(eq(t.passwordResets.userId, user.id), gt(t.passwordResets.createdAt, Date.now() - 60_000)))
      .get();
    if (recent) return;
    const token = await createPasswordReset(user.id);
    const url = `${appUrl()}/reset-password/${token}`;
    try {
      await sendEmail({ to: email, ...resetPasswordEmail({ name: user.name, url, minutes: RESET_MINUTES }) });
    } catch (e) {
      console.error("password reset email failed", e);
    }
  });
  return { sent: true, email };
}

export type ResetState = { error?: string; expired?: boolean } | undefined;

/** Sets a new password from a reset link, signs out every other device and signs in here. */
export async function resetPassword(_: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (formData.get("confirm") !== password) return { error: "Passwords don't match." };

  const reset = await consumePasswordReset(token);
  if (!reset) return { error: "This link has expired or was already used.", expired: true };

  await db.batch([
    db.update(t.users).set({ passwordHash: await hashPassword(password) }).where(eq(t.users.id, reset.userId)),
    db.delete(t.passwordResets).where(eq(t.passwordResets.userId, reset.userId)),
    db.delete(t.sessions).where(eq(t.sessions.userId, reset.userId)),
  ]);
  await createSession(reset.userId);
  redirect("/");
}
