import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    const data = await LearningService.getChannelMixAnalysis();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Channel mix error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel mix analysis" },
      { status: 500 }
    );
  }
}
