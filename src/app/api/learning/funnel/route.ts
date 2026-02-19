import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const funnel = await LearningService.getConversionFunnel(campaignId);

    return NextResponse.json({ funnel });
  } catch (error) {
    console.error("Learning funnel error:", error);
    return NextResponse.json(
      { error: "Failed to fetch funnel data" },
      { status: 500 }
    );
  }
}
