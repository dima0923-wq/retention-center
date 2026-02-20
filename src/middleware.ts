import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";
const SELF_URL = "https://ag2.q37fh758g.click";

const PUBLIC_PATHS = [
  "/auth/",
  "/_next/",
  "/api/webhooks/",
  "/favicon.ico",
  "/api/auth/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ac_access");
  const tokenValue = token?.value;
  // Basic JWT format check: must have 3 dot-separated parts
  const isValidFormat =
    tokenValue &&
    tokenValue.split(".").length === 3 &&
    tokenValue.length > 20;

  if (isValidFormat) {
    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // Redirect to Auth Center login with callback to our token route
  const callbackUrl = `${SELF_URL}/auth/token`;
  const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
