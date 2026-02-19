import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const stats = await CampaignService.getStats(id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/campaigns/[id]/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
