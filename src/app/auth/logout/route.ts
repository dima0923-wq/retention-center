import { NextResponse } from "next/server";

const AUTH_CENTER_URL = "https://ag4.q37fh758g.click";

/**
 * GET /auth/logout — redirect to Auth Center logout.
 * Auth Center clears the shared `ac_access` cookie on `.q37fh758g.click`.
 */
export async function GET() {
  return NextResponse.redirect(`${AUTH_CENTER_URL}/logout`);
}

/**
 * POST /auth/logout — API-style logout (for fetch calls).
 */
export async function POST() {
  return NextResponse.json({ success: true });
}
