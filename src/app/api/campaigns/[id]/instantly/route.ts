import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CampaignService } from "@/services/campaign.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:campaigns:edit');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = z.object({ action: z.enum(["launch", "pause"]) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const { action } = parsed.data;

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
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/campaigns/[id]/instantly error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
