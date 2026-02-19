import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaign = await CampaignService.start(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/campaigns/[id]/start error:", error);
    if (message.includes("Campaign not found")) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (message.includes("Invalid status transition")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
