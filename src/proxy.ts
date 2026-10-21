import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "timeo_session";
const PUBLIC = ["/welcome", "/login", "/signup", "/forgot-password", "/reset-password"];

// Optimistic check only: real authorisation happens in requireUser().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    // Signed-out visitors of the home page see the landing page; deep links go to sign in
    return NextResponse.redirect(new URL(pathname === "/" ? "/welcome" : "/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|sw\\.js|manifest\\.webmanifest|icon|apple-icon|.*\\.(?:png|svg|ico|jpg|webp|txt|html)$).*)"],
};
