import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    const { id } = await context.params;
    const stats = await CampaignService.getStats(id);
    if (!stats) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/campaigns/[id]/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
