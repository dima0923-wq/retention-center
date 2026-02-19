import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === "launch") {
      const result = await CampaignService.syncToInstantly(id);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === "pause") {
      // Pause is a no-op locally — Instantly API doesn't have a direct pause endpoint
      // The campaign status on our side is managed via the regular pause route
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/campaigns/[id]/instantly error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
