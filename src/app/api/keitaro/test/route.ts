import { NextRequest, NextResponse } from "next/server";
import { KeitaroClient } from "@/lib/keitaro-client";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Allow caller to supply custom credentials for a one-off test
  let baseUrl: string | undefined;
  let apiKey: string | undefined;

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.baseUrl === "string") baseUrl = body.baseUrl;
    if (typeof body.apiKey === "string") apiKey = body.apiKey;
  } catch {
    // Body is optional — fall through using env defaults
  }

  const client = new KeitaroClient(baseUrl, apiKey);
  const result = await client.testConnection();

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
