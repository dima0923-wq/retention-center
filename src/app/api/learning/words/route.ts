import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const channel = url.searchParams.get("channel") || "SMS";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);

    const result = await LearningService.getTopPerformingWords(channel, limit);

    return NextResponse.json({
      data: result.words,
      total: result.words.length,
      baseConversionRate: result.baseConversionRate,
      totalAttempts: result.totalAttempts,
    });
  } catch (error) {
    console.error("Learning words error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top words" },
      { status: 500 }
    );
  }
}
