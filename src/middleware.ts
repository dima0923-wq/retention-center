import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";
const SELF_URL = "https://ag2.q37fh758g.click";

const jwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = jwtSecret
  ? new TextEncoder().encode(jwtSecret)
  : null;

const PUBLIC_PATHS = [
  "/health",
  "/auth/",
  "/_next/",
  "/api/webhooks/",
  "/favicon.ico",
  "/api/auth/",
  "/api/cron/",
  "/api/health",
  "/api/vapi-calls/auto-sync",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Service-to-service API key bypass (for Hermes, Traffic Center, etc.)
  const serviceKey = request.headers.get("x-service-key");
  if (serviceKey && serviceKey === process.env.SERVICE_API_KEY) {
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
    // Verify JWT signature if secret is available
    if (JWT_SECRET) {
      try {
        const { payload } = await jwtVerify(tokenValue, JWT_SECRET, {
          issuer: "auth-center",
        });

        // Check project claim
        if (payload.project && payload.project !== "retention_center") {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "Access denied: not authorized for this project" },
              { status: 403 }
            );
          }
          const callbackUrl = `${SELF_URL}/auth/token`;
          const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete("ac_access");
          return response;
        }
      } catch {
        // Signature verification failed — token is forged or expired
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Invalid or expired token" },
            { status: 401 }
          );
        }
        const callbackUrl = `${SELF_URL}/auth/token`;
        const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("ac_access");
        return response;
      }
    } else {
      // Fallback: no JWT_SECRET configured — decode-only project check (legacy)
      try {
        const payload = JSON.parse(atob(tokenValue.split('.')[1]));
        if (payload.project && payload.project !== 'retention_center') {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "Access denied: not authorized for this project" },
              { status: 403 }
            );
          }
          const callbackUrl = `${SELF_URL}/auth/token`;
          const loginUrl = `${AUTH_CENTER_URL}/login?redirect_url=${encodeURIComponent(callbackUrl)}`;
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete("ac_access");
          return response;
        }
      } catch {
        // If JWT decode fails, let it pass — Auth Center API will verify
      }
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
