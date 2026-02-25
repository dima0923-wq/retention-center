import { NextRequest, NextResponse } from "next/server";
import { keitaroClient, KeitaroError } from "@/lib/keitaro-client";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  try {
    const campaigns = await keitaroClient.listCampaigns();
    return NextResponse.json(campaigns);
  } catch (error) {
    if (error instanceof KeitaroError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }
    console.error("GET /api/keitaro/campaigns error:", error);
    return NextResponse.json({ error: "Failed to fetch Keitaro campaigns" }, { status: 502 });
  }
}
