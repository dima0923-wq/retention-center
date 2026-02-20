import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side auth token handler.
 *
 * Auth Center redirects here after login. The shared cookie `ac_access`
 * is already set by Auth Center on `.q37fh758g.click`, so this route
 * just redirects to the app root.
 */
function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "ag2.q37fh758g.click";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", getBaseUrl(request)));
}
