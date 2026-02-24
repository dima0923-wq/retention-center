import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { campaignLeadsSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:campaigns:view');
    const { id } = await context.params;
    const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("page")) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("pageSize")) || 20)));
    const result = await CampaignService.listLeads(id, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:campaigns:edit');
    const { id } = await context.params;
    const body = await req.json();

    // Handle sync_instantly action
    if (body.action === "sync_instantly") {
      const result = await CampaignService.pushLeadsToInstantly(id);
      if ("error" in result) {
        const status = result.error === "Campaign not found" ? 404 : 400;
        return NextResponse.json({ error: result.error }, { status });
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
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Campaign not found")) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    console.error("POST /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:campaigns:edit');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = campaignLeadsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const result = await CampaignService.removeLeads(id, parsed.data.leadIds);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("DELETE /api/campaigns/[id]/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
