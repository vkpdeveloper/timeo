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
  verifyPasswordDummy,
} from "@/lib/auth";
import { clientIp, rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { appUrl, resetPasswordEmail, sendEmail } from "@/lib/email";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";
import { validTimezone } from "@/lib/dates";
import { takeGoogleLink } from "@/lib/google-auth";
import { seedNewUser } from "@/lib/seed";

export type AuthState = { error?: string; email?: string; name?: string } | undefined;

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const timezone = validTimezone(formData.get("timezone"));

  if (!rateLimit(`signup:${await clientIp()}`, 10, 60 * 60_000)) {
    return { error: "Too many attempts. Try again later.", email, name };
  }
  if (!name) return { error: "Your first name", email, name };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right.", email, name };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email, name };
  if (password.length > 200) return { error: "That password is too long.", email, name };

  const existing = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, email)).get();
  if (existing) return { error: "An account with this email already exists. Sign in instead.", email, name };

  const id = crypto.randomUUID();
  await db.insert(t.users).values({ id, name, email, passwordHash: await hashPassword(password), timezone, aiModel: DEFAULT_AI_MODEL });
  await seedNewUser(id);
  await createSession(id);
  redirect("/app/welcome");
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const timezone = validTimezone(formData.get("timezone"));

  const key = `login:${await clientIp()}:${email}`;
  if (!rateLimit(key, 10, 15 * 60_000)) {
    return { error: "Too many attempts. Try again in a few minutes.", email };
  }
  const user = await db.select().from(t.users).where(eq(t.users.email, email)).get();
  // Google-only accounts have no password; they take as long to refuse as a wrong one
  if (!user?.passwordHash) await verifyPasswordDummy(password);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect.", email };
  }
  rateLimitReset(key);
  if (timezone !== "UTC" && timezone !== user.timezone) {
    await db.update(t.users).set({ timezone }).where(eq(t.users.id, user.id));
  }
  // "Continue with Google" found this account by email: the password proves it's theirs, so link it
  const google = await takeGoogleLink();
  if (google && google.email === user.email && !user.googleId) {
    const owner = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.googleId, google.sub)).get();
    if (!owner) await db.update(t.users).set({ googleId: google.sub }).where(eq(t.users.id, user.id));
  }
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export type ForgotState = { sent?: boolean; error?: string; email?: string } | undefined;

/** Emails a reset link. Answers the same whether or not the account exists, and sends after the
 * response, so neither the reply nor its timing says which emails have accounts. */
export async function requestPasswordReset(_: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right.", email };
  // Per-IP cap alongside the per-account 1/min check below; the reply
  // stays identical whether or not an email is actually sent.
  if (!rateLimit(`reset:${await clientIp()}`, 10, 60 * 60_000)) return { sent: true, email };

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
  redirect("/app");
}
