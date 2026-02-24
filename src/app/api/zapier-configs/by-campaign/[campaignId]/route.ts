import { NextRequest, NextResponse } from "next/server";
import { ZapierConfigService } from "@/services/zapier-config.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    const { campaignId } = await context.params;
    const configs = await ZapierConfigService.findByCampaignId(campaignId);
    return NextResponse.json(configs);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/zapier-configs/by-campaign/[campaignId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
