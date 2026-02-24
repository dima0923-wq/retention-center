import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const insights = await LearningService.generateInsights(campaignId);

    return NextResponse.json({ insights });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Learning insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
