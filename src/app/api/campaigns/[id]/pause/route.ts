import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaign = await CampaignService.pause(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Invalid status transition") ? 400 : 500;
    console.error("POST /api/campaigns/[id]/pause error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
