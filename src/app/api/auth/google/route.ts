import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { validTimezone } from "@/lib/dates";
import { googleSignInEnabled, googleSignInUrl } from "@/lib/google-auth";
import { beginOAuthFlow } from "@/lib/oauth-flow";

// Starts "Continue with Google". ?intent=link adds Google sign-in to the signed-in account
// (Settings); ?tz= carries the device timezone for a new account.
export async function GET(req: NextRequest) {
  await connection();
  if (!googleSignInEnabled()) redirect("/login");
  const sp = req.nextUrl.searchParams;
  const link = sp.get("intent") === "link";
  const user = link ? await getUser() : null;
  if (link && !user) redirect("/login");
  const flow = await beginOAuthFlow({
    purpose: link ? "link" : "signin",
    userId: user?.id,
    timezone: validTimezone(sp.get("tz")),
  });
  redirect(googleSignInUrl(flow, user?.email));
}
