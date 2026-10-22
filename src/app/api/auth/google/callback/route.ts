import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db, t } from "@/db";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";
import { createSession, getUser } from "@/lib/auth";
import { validTimezone } from "@/lib/dates";
import { googleProfile, holdGoogleLink, type GoogleProfile } from "@/lib/google-auth";
import { endOAuthFlow } from "@/lib/oauth-flow";
import { seedNewUser } from "@/lib/seed";

// Google sends the browser back here after "Continue with Google".
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const flow = await endOAuthFlow(sp.get("state"));
  if (!flow || (flow.purpose !== "signin" && flow.purpose !== "link")) redirect("/login?error=google");
  const back = flow.purpose === "link" ? "/app/settings" : "/login";
  const code = sp.get("code");
  // cancelled on Google's screen: just go back
  if (!code) redirect(sp.get("error") === "access_denied" ? back : `${back}?error=google`);

  let profile: GoogleProfile | null = null;
  try {
    profile = await googleProfile(code, flow.verifier, flow.nonce);
  } catch (e) {
    console.error("google sign-in failed", e);
  }
  if (!profile) redirect(`${back}?error=google`);

  if (flow.purpose === "link") {
    const user = await getUser();
    if (!user || user.id !== flow.userId) redirect("/login");
    const owner = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.googleId, profile.sub)).get();
    if (owner && owner.id !== user.id) redirect("/app/settings?google=taken");
    await db.update(t.users).set({ googleId: profile.sub }).where(eq(t.users.id, user.id));
    redirect("/app/settings?google=linked");
  }

  const timezone = validTimezone(flow.timezone);
  const linked = await db
    .select({ id: t.users.id, timezone: t.users.timezone })
    .from(t.users)
    .where(eq(t.users.googleId, profile.sub))
    .get();
  if (linked) {
    if (timezone !== "UTC" && timezone !== linked.timezone) {
      await db.update(t.users).set({ timezone }).where(eq(t.users.id, linked.id));
    }
    await createSession(linked.id);
    redirect("/app");
  }

  // An account with this email already exists: link once its password is entered.
  const existing = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, profile.email)).get();
  if (existing) {
    await holdGoogleLink(profile);
    redirect(`/login?link=google&email=${encodeURIComponent(profile.email)}`);
  }

  const id = crypto.randomUUID();
  await db.insert(t.users).values({
    id,
    name: profile.name,
    email: profile.email,
    passwordHash: "",
    googleId: profile.sub,
    timezone,
    aiModel: DEFAULT_AI_MODEL,
  });
  await seedNewUser(id);
  await createSession(id);
  redirect("/app/welcome");
}
