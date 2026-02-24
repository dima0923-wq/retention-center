import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');
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
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Heatmap error:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
