import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { campaignUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaign = await CampaignService.getById(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    console.error("GET /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = campaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const campaign = await CampaignService.update(id, parsed.data);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("PATCH /api/campaigns/[id] error:", error);
    if (message.includes("Campaign not found")) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (message.includes("Invalid status transition")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await CampaignService.delete(id);
    if (!result) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Only draft") ? 400 : 500;
    console.error("DELETE /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
