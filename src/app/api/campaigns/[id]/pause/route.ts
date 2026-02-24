import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    requirePermission(user, 'retention:campaigns:edit');
    const { id } = await context.params;
    const campaign = await CampaignService.pause(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/campaigns/[id]/pause error:", error);
    if (message.includes("Campaign not found")) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (message.includes("Invalid status transition")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
