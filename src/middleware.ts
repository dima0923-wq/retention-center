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
  "/api/cron/",
  "/api/health",
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
    // Check project claim in JWT payload
    try {
      const payload = JSON.parse(atob(tokenValue.split('.')[1]));
      if (payload.project && payload.project !== 'retention_center') {
        // Wrong project — redirect to Auth Center login with correct project
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Access denied: not authorized for this project" },
            { status: 403 }
          );
        }
        const callbackUrl = `${SELF_URL}/auth/token`;
        const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      // If JWT decode fails, let it pass — Auth Center will verify properly
    }

    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // API routes should return 401 JSON, not redirect
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
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
