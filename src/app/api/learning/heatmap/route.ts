import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";

export async function GET(req: NextRequest) {
  try {
    const channel = req.nextUrl.searchParams.get("channel") || undefined;
    const data = await LearningService.getTimeAnalysis(channel);

    const cells = data.heatmap.map((h) => ({
      day: h.dayOfWeek,
      hour: h.hour,
      conversions: h.converted,
      attempts: h.total,
      rate: h.conversionRate,
    }));

    return NextResponse.json(cells);
  } catch (error) {
    console.error("Heatmap error:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
