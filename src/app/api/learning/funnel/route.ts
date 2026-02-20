import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const funnel = await LearningService.getConversionFunnel(campaignId);

    return NextResponse.json({ funnel });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Learning funnel error:", error);
    return NextResponse.json(
      { error: "Failed to fetch funnel data" },
      { status: 500 }
    );
  }
}
