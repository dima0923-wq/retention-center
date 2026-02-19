import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;
    const channel = url.searchParams.get("channel") || "SMS";

    const result = await LearningService.suggestOptimalScript(channel, campaignId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Learning suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
