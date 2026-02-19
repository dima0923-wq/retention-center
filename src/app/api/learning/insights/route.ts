import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const insights = await LearningService.generateInsights(campaignId);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Learning insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
