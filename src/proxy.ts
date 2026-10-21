import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "timeo_session";
const PUBLIC = ["/login", "/signup", "/forgot-password", "/reset-password"];

// Optimistic check only: real authorisation happens in requireUser().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  // "/" is the landing page. Matched exactly: as a prefix it would make every path public.
  const isPublic = pathname === "/" || PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|sw\\.js|manifest\\.webmanifest|icon|apple-icon|.*\\.(?:png|svg|ico|jpg|webp|txt|html)$).*)"],
};
