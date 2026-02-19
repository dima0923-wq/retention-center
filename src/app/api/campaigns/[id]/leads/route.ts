import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { campaignLeadsSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");
    const result = await CampaignService.listLeads(id, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    // Handle sync_instantly action
    if (body.action === "sync_instantly") {
      const result = await CampaignService.pushLeadsToInstantly(id);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    // Default: assign leads
    const parsed = campaignLeadsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await CampaignService.assignLeads(id, parsed.data.leadIds);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = campaignLeadsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await CampaignService.removeLeads(id, parsed.data.leadIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("DELETE /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
