import { NextRequest, NextResponse } from "next/server";
import { LearningService } from "@/services/learning.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');
    const data = await LearningService.getSequencePerformance();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Sequence performance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence performance" },
      { status: 500 }
    );
  }
}
