import { NextRequest, NextResponse } from "next/server";
import { ZapierConfigService } from "@/services/zapier-config.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;
    const configs = await ZapierConfigService.findAll(campaignId);
    return NextResponse.json(configs);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/zapier-configs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const body = await req.json();
    if (!body.campaignId || !body.metaCampaignId) {
      return NextResponse.json(
        { error: "campaignId and metaCampaignId are required" },
        { status: 400 }
      );
    }
    const config = await ZapierConfigService.create(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Campaign not found" || message === "Sequence not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("POST /api/zapier-configs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
