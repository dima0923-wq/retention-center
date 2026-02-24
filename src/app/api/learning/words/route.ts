import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');
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
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Learning words error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top words" },
      { status: 500 }
    );
  }
}
